"""Admit four completed native scenarios into a compact browser replay package."""

import argparse
import copy
import hashlib
import json
from pathlib import Path

from guided_model import CAPACITY_L, DATASET, LITRES_PER_DAY_M3S, VERSION, forcing, sha, versions, write


def build(audit: Path, output: Path) -> dict[str, object]:
    f = forcing()
    scenarios = {}
    keys = ("normal-natural", "normal-managed", "dry-natural", "dry-managed")
    for key in keys:
        source = audit / key / "result.json"
        supervisor = json.loads((audit / key / "supervisor.json").read_text())
        if supervisor["status"] != "passed":
            raise ValueError(f"{key} lacks passed supervisor")
        scenario = json.loads(source.read_text())
        if scenario["status"] != "passed" or len(scenario["dates"]) != 365:
            raise ValueError(f"{key} incomplete")
        if scenario["balances"]["maxResidualCounts"] != 0:
            raise ValueError(f"{key} balance failure")
        if scenario["provenance"]["sourceSha256"] != sha(Path(__file__).with_name("guided_model.py")):
            raise ValueError("Model source changed after execution")
        item = copy.deepcopy(scenario)
        identity = {
            "datasetId": DATASET,
            "referenceVersion": "guided-natural-reference-v1",
            "policyVersion": "guided-policy-v1",
            "checkpoint": "R2b",
            "mappingVersion": "guided-map-v1",
        }
        item["provenance"].update(identity)
        item["criteria"].update(identity)
        chunks = item["provenance"].pop("chunks")
        item["provenance"]["chunkCount"] = len(chunks)
        item["provenance"]["firstModelDigest"] = chunks[0]["modelDigest"]
        item["provenance"]["lastModelDigest"] = chunks[-1]["modelDigest"]
        item["provenance"]["chunkManifestSha256"] = hashlib.sha256(
            json.dumps(chunks, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        item["provenance"]["fullResultSha256"] = sha(source)
        item["provenance"]["supervisor"] = supervisor
        item["provenance"]["supervisor"].pop("command")
        for criterion in item["findings"].values():
            criterion["dependencies"] = list(dict.fromkeys(criterion["dependencies"]))
        scenarios[key] = item
    for forcing_name in ("normal", "dry"):
        expected = [q * (0.4 if forcing_name == "dry" else 1) / LITRES_PER_DAY_M3S for q in f["referenceL"]]
        got = scenarios[forcing_name + "-natural"]["series"]["R2bM3s"]
        if any(abs(a - b) > 1e-12 for a, b in zip(expected, got, strict=True)):
            raise ValueError("Analytical reference/native pair mismatch")
    schedules = [s["criteria"]["ecologicalM3s"] for s in scenarios.values()]
    if any(x != schedules[0] for x in schedules):
        raise ValueError("Ecological target changed with supply")
    body_rows = [
        ("R1", "Natural river", "natural", "natural/status", ["r1"], "intake"),
        ("R2", "Altered natural river", "natural", "natural/status", ["r2a", "r2b"], "r2b"),
        ("C1", "Constructed canal", "artificial", "potential", ["c1"], "c1"),
        ("D1", "Constructed collector-drain", "artificial", "potential", ["d1"], "d1"),
        ("S1", "Constructed reservoir", "artificial", "potential", ["s1"], "s1"),
        ("W1", "Natural wetland", "natural", "natural/status", [], None),
    ]
    bodies = [
        {
            "id": i,
            "name": n,
            "origin": o,
            "designation": "none",
            "track": t,
            "reachIds": r,
            "checkpoint": c,
            "designationEvidence": "Fictional assumed records check; no official designation",
            "receptor": i == "W1",
        }
        for i, n, o, t, r, c in body_rows
    ]
    nodes = [
        {"id": "boundary", "type": "source"},
        {"id": "intake", "type": "junction"},
        {"id": "S1", "type": "storage", "nativeId": "s1"},
        {"id": "irrigation", "type": "water-use"},
        {"id": "return-junction", "type": "junction"},
        {"id": "outlet", "type": "sink"},
        {"id": "natural_exchange", "type": "natural-sink"},
        {"id": "atmosphere", "type": "consumption-sink"},
        {"id": "W1", "type": "receptor", "connection": "unknown"},
    ]
    links = [
        {"id": "R1", "from": "boundary", "to": "intake", "bodyId": "R1", "nativeId": "r1"},
        {"id": "C1", "from": "intake", "to": "irrigation", "bodyId": "C1", "nativeId": "c1"},
        {"id": "D1", "from": "irrigation", "to": "return-junction", "bodyId": "D1", "nativeId": "d1"},
        {"id": "reservoir-inlet", "from": "intake", "to": "S1", "nativeId": "intake"},
        {"id": "R2a", "from": "S1", "to": "return-junction", "bodyId": "R2", "nativeId": "r2a"},
        {"id": "R2b", "from": "return-junction", "to": "outlet", "bodyId": "R2", "nativeId": "r2b"},
    ]
    changes = [
        {"item": "Boundary climate/forcing", "natural": "Same selected forcing", "managed": "Same selected forcing"},
        {"item": "R1 natural exchange", "natural": "5% mixed water/salt sink retained", "managed": "Identical5% sink"},
        {
            "item": "C1 diversion and D1 return",
            "natural": "Inactive computational skeleton; no physical canal/return flux",
            "managed": "Reserve-aware abstraction;50% water-only consumption; same-day return carries all diverted salt",
        },
        {
            "item": "S1 counterpart",
            "natural": "Explicit hypothetical memoryless natural channel, no storage or artificial initial inventory",
            "managed": "5Mm3 reservoir, initial0, spill before target release",
        },
        {
            "item": "W1 connectivity",
            "natural": "Unknown, omitted from native network",
            "managed": "Unknown, omitted from native network",
        },
    ]
    limitations = [
        "Entirely synthetic teaching scenario, no observations or accepted natural reconstruction",
        "The annual75% quantity component is not a complete baseline ecological requirement: daily risk/winter/spawning/quality adjustments are omitted",
        "Natural5% exchange is a prescribed mixed sink, not a groundwater model; no natural storage, travel time or floodplain hydraulics modelled",
        "Inactive canal/return bookkeeping nodes remain in the natural API skeleton; their physical flows are zero",
        "Classification changes metadata and assessment route only; it never changes physics automatically",
        "Natural and managed configurations are not independent reference reconstructions",
        "All native annual results are stitched from122 executions of3days or less with full water/salt inventory and absolute-date forcing carryover",
        "Reservoir outlet has no capacity limit, no dead storage or future-reserve obligation; prospective deliverability is a conditional same-day upper bound after committed diversion",
        "No thermal calculation in this dataset; daily means do not establish subdaily extremes",
        "Ecological, issued and measured/simulated values have distinct roles; no status or legal-fault verdict",
    ]
    result = {
        "schemaVersion": "eflow-guided/1",
        "datasetId": DATASET,
        "metadata": {
            "status": "admitted",
            "synthetic": True,
            "period": {"start": f["dates"][0], "end": f["dates"][-1]},
            "timeSupport": "365 daily mean intervals; no leap day",
            "versions": versions(),
            "physicsVersion": VERSION,
            "limitations": limitations,
            "waterQuantumM3": 0.001,
            "forcingAdmission": "Boundary rounded to200m3/day; ecological instruction rounded up to2m3/day; native accounts exact1L",
            "sourceManifest": {p.name: sha(p) for p in Path(__file__).parent.glob("*.py")},
        },
        "dates": f["dates"],
        "waterBodies": bodies,
        "network": {
            "nodes": nodes,
            "links": links,
            "counterpartChanges": changes,
            "capacityM3": CAPACITY_L / 1000,
            "initialManagedStorageM3": 0,
            "nativeMapping": {"R1": ["r1"], "R2a": ["r2a"], "R2b": ["r2b"], "C1": ["c1"], "D1": ["d1"], "S1": ["s1"]},
            "nativeIdMapping": {"R1": "r1", "R2a": "r2a", "R2b": "r2b", "S1": "s1", "C1": "c1", "D1": "d1"},
        },
        "reference": {
            "version": "guided-natural-reference-v1",
            "recordYears": 100,
            "checkpoint": "R2b",
            "dailyM3s": [q / LITRES_PER_DAY_M3S for q in f["referenceL"]],
            "methodDescription": f["basis"],
            "annualFactors": f["annualFactors"],
            "recordRepresentation": "100 explicit factors times fixed365day boundary; memoryless95% analytical routing, spot-checked against365day native normal and40% dry runs",
            "annualVolumeMm3": sum(f["referenceL"]) / 1e9,
        },
        "method": {
            "id": "annual-probability-component",
            "policyVersion": "guided-policy-v1",
            "checkpoint": "R2b",
            "ecologicalM3s": [q / LITRES_PER_DAY_M3S for q in f["ecologicalL"]],
            "annualVolumeMm3": sum(f["ecologicalL"]) / 1e9,
            "description": "50% design class →75% annual exceedance magnitude and daily shape; rounded supplied teaching schedule enters native reservoir release and Fishy ecological criterion. This component is not the full method.",
            "designClass": 50,
            "shiftedClass": 75,
            "shiftFactor": f["shiftFactor"],
            "diagnostics": {
                "annualExceedanceRank": 75.75,
                "referenceMedianRank": 50.5,
                "ecologicalInstructionQuantizationM3": 2,
                "referenceHeldAcrossSupplyShock": True,
            },
            "assumptions": limitations[:3],
        },
        "scenarios": scenarios,
        "shortfallCase": json.loads((audit / "shortfall-v2/result.json").read_text()),
        "admission": {
            "chunkEquivalence": json.loads((audit / "chunk_admission.json").read_text()),
            "annualComplete": True,
            "zeroFlowEvidence": json.loads((audit / "zero-evidence/zero_admission.json").read_text()),
            "nativeScenarioCount": 4,
            "annualWallSeconds": sum(s["provenance"]["supervisor"]["elapsedSeconds"] for s in scenarios.values()),
            "publication": "Synthetic data only; observed2017 not included",
        },
    }
    output.mkdir(parents=True, exist_ok=True)
    write(output / "guided.json", result)
    (output / "guided-data.js").write_text(
        "window.EflowGuidedData = " + json.dumps(result, separators=(",", ":"), allow_nan=False) + ";\n"
    )
    return result


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--audit", type=Path, required=True)
    p.add_argument("--output", type=Path, default=Path("../data"))
    a = p.parse_args()
    build(a.audit, a.output)


if __name__ == "__main__":
    main()
