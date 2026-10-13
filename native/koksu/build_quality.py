"""Bound native quality runs and assemble the reviewed-water-linked candidate."""
from __future__ import annotations

import argparse
from dataclasses import asdict
import hashlib
import json
import logging
from pathlib import Path
import subprocess
import sys
import time

from native_comparison import digest, load_candidate, load_forcing, save, versions
from native_contracts import Policy


def build(repo: Path, audit: Path) -> None:
    prototype = repo / "prototype"
    native = repo / "native" / "koksu"
    files = [*prototype.glob("comparison-*.json"), prototype / "targets.json", prototype / "targets-stress.json", native / "native_comparison.py", native / "native_contracts.py", native / "koksu_forcing.csv", native / "native_quality.py", Path(__file__)]
    frozen = {str(path): digest(path) for path in files}
    contract = json.loads((audit / "CONTRACT.json").read_text())
    cases, completed, execution = {}, {}, []
    started = time.monotonic()
    for operation in ("ecology", "irrigation"):
        for basis in ("matched", "fixed"):
            water_path = prototype / (f"comparison-{operation}.json" if basis == "matched" else f"comparison-stress-{operation}.json")
            water = json.loads(water_path.read_text())
            targets = prototype / ("targets.json" if basis == "matched" else "targets-stress.json")
            target_document = json.loads(targets.read_text())
            for climate, year in (("normal", 2011), ("dry", 2021)):
                forcing = load_forcing(native / "koksu_forcing.csv", year, target_document["reference"]["sourceSha256"])
                policy = Policy(priority=operation + "-first")
                for method in ("swiss", "kazakh", "site"):
                    key = f"{operation}:{basis}:{climate}:{method}"
                    candidate = load_candidate(targets, method, forcing, policy)
                    identity = {"forcing": asdict(forcing), "policy": asdict(policy), "method": method, "rawCandidate": [str(x) for x in candidate.raw_m3s], "targetLitres": candidate.target_litres, "backgroundMgL": 180, "limitMgL": 250}
                    signature = hashlib.sha256(json.dumps(identity, sort_keys=True, default=str).encode()).hexdigest()
                    if signature not in completed:
                        remaining = 1200 - (time.monotonic() - started)
                        if remaining < 1:
                            raise RuntimeError("Aggregate1200-second budget exhausted")
                        if any(digest(Path(path)) != checksum for path, checksum in frozen.items()):
                            raise RuntimeError("Frozen source changed")
                        run_id = key.replace(":", "-")
                        folder = audit / "native-annual" / run_id
                        if folder.exists():
                            raise RuntimeError(f"Refuse overwrite {folder}")
                        command = [sys.executable, str(repo / "native" / "supervise.py"), "--seconds", str(min(300, int(remaining))), "--output", str(folder), "--", sys.executable, str(native / "native_quality.py"), "--source", str(native / "koksu_forcing.csv"), "--targets", str(targets), "--year", str(year), "--method", method, "--priority", policy.priority, "--output", str(folder)]
                        outcome = subprocess.run(command, check=False)
                        supervisor = json.loads((folder / "supervisor.json").read_text())
                        execution.append({"id": run_id, "supervisor": supervisor})
                        save(audit / "MATRIX_STATE.json", {"status": "running" if outcome.returncode == 0 else "failed", "execution": execution, "frozen": frozen, "elapsedSeconds": time.monotonic() - started})
                        if outcome.returncode:
                            raise RuntimeError("Native quality case failed; no automatic retry")
                        raw = json.loads((folder / "result.json").read_text())
                        completed[signature] = (run_id, raw, digest(folder / "result.json"))
                        logging.warning("Completed %s in %.2fs", run_id, supervisor["elapsedSeconds"])
                    run_id, raw, result_sha = completed[signature]
                    original = water["scenarios"][climate]["methods"][method]
                    if raw["ledger"] != original["ledger"] or raw["dates"] != water["scenarios"][climate]["dates"]:
                        raise AssertionError(f"Frozen water ledger differs {key}")
                    for section, original_field, flow_field in (("r2a", "r2aFishyAssessment", "actualR2aM3s"), ("r2b", "fishyAssessment", "actualM3s")):
                        if raw["sections"][section]["flowM3s"] != original[flow_field]:
                            raise AssertionError(f"Frozen water flow differs {key} {section}")
                        for kind in ("candidate", "issued"):
                            for field in ("rawFishy", "shortfallM3s", "shortfallDays"):
                                if raw["quantity"][section][kind][field] != original[original_field][kind][field]:
                                    raise AssertionError(f"Frozen Fishy quantity differs {key} {section} {kind} {field}")
                            if abs(raw["quantity"][section][kind]["shortfallVolumeM3"] - original[original_field][kind]["shortfallVolumeM3"]) > 1e-7:
                                raise AssertionError(f"Frozen quantity volume differs {key} {section} {kind}")
                    active_water = prototype / f"comparison-{operation}.json" if climate == "normal" else water_path
                    active_case = json.loads(active_water.read_text())["scenarios"][climate]["methods"][method]
                    if active_case != original:
                        raise AssertionError(f"Normal fixed alias differs from active water {key}")
                    cases[key] = {"dates": raw["dates"], "sections": raw["sections"], "drain": raw["drain"], "waterArtifactSha256": digest(active_water), "balances": raw["balances"], "provenance": {**raw["provenance"], "executedRunId": run_id, "nativeResultSha256": result_sha, "inputSignatureSha256": signature, "selectedTargetsSha256": digest(targets), "reuseReason": "Identical forcing, dates, method, complete raw/quantized candidate, policy and quality inputs" if run_id != key.replace(":", "-") else None, "chunks": raw["chunks"]}}
    if len(cases) != 24 or len(completed) != 14:
        raise AssertionError("Expected24display selections and14unique managed runs")
    if any(digest(Path(path)) != checksum for path, checksum in frozen.items()):
        raise AssertionError("Frozen source changed during matrix")
    payload = {"schemaVersion": "prototype-quality-v1", "status": "candidate", "criterion": {"id": "salt-limit", "version": "koksu-conservative-salt-v1", "limitMgL": 250, "comparison": "<=", "applicability": "hypothetical", "basis": "daily mean"}, "assumptions": contract["assumptions"], "cases": cases, "provenance": {"versions": versions(), "contractSha256": digest(audit / "CONTRACT.json"), "uniqueNativeCases": len(completed), "physicalChunks": sum(len(raw["chunks"]) for _, raw, _ in completed.values()), "moduleHashes": {Path(path).name: checksum for path, checksum in frozen.items() if Path(path).suffix == ".py"}, "limitations": contract["excluded"]}}
    save(prototype / "quality.json", payload)
    save(audit / "MATRIX_STATE.json", {"status": "candidate_pending_independent_review", "execution": execution, "frozen": frozen, "elapsedSeconds": time.monotonic()-started, "qualitySha256": digest(prototype / "quality.json"), "uniqueNativeCases": len(completed), "displayCases": len(cases)})


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, required=True)
    args = parser.parse_args()
    build(Path(__file__).resolve().parents[2], args.audit.resolve())


if __name__ == "__main__":
    main()
