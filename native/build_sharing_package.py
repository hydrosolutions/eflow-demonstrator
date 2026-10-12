"""Package the additive native scenario; verify its unchanged parent evidence."""

import argparse
import copy
import hashlib
import json
from pathlib import Path

from sharing_model import DATASET, ECO_VERSION, ISSUED_VERSION, SCENARIO, VERSION, forcing, sha, write


def build(audit: Path, parent_path: Path, output: Path) -> dict[str, object]:
    parent = json.loads(parent_path.read_text())
    result_path = audit / "dry-managed-sharing-attempt-02" / "result.json"
    result = json.loads(result_path.read_text())
    supervisor = json.loads((audit / "dry-managed-sharing-attempt-02" / "supervisor.json").read_text())
    if result["status"] != "passed" or supervisor["status"] != "passed" or len(result["dates"]) != 365:
        raise ValueError("Annual native sharing scenario is incomplete")
    model_path = Path(__file__).with_name("sharing_model.py")
    base_path = Path(__file__).with_name("guided_model.py")
    if result["provenance"]["sourceSha256"] != sha(model_path) or result["provenance"]["baseSourceSha256"] != sha(
        base_path
    ):
        raise ValueError("Native source changed after execution")
    if parent["metadata"]["sourceManifest"]["guided_model.py"] != sha(base_path):
        raise ValueError("Imported base source no longer matches the admitted parent")
    base = parent["scenarios"]["dry-managed"]
    if result["dates"] != parent["dates"] or result["series"]["boundaryM3s"] != base["series"]["boundaryM3s"]:
        raise ValueError("Calendar or drought forcing does not match parent")
    if result["criteria"]["ecologicalM3s"] != parent["method"]["ecologicalM3s"]:
        raise ValueError("Ecological schedule changed")
    if result["balances"]["maxResidualCounts"] != 0 or result["balances"]["nativeWaterSaltResidualCounts"] != 0:
        raise ValueError("Physical balances fail")
    item = copy.deepcopy(result)
    identity = {
        "datasetId": DATASET,
        "referenceVersion": parent["reference"]["version"],
        "policyVersion": ECO_VERSION,
        "allocationPolicyVersion": ISSUED_VERSION,
        "mappingVersion": "guided-map-v1",
        "checkpoint": "R2b",
    }
    item["provenance"].update(identity)
    item["criteria"].update(identity)
    item["criteria"].update(ecologicalVersion=ECO_VERSION, issuedVersion=ISSUED_VERSION)
    for kind, version in (("ecological", ECO_VERSION), ("issued", ISSUED_VERSION)):
        if item["findings"][kind]["criterionVersion"] != version:
            raise ValueError(f"{kind} Fishy version does not match criterion")
    chunks = item["provenance"].pop("chunks")
    item["provenance"].update(
        chunkCount=len(chunks),
        firstModelDigest=chunks[0]["modelDigest"],
        lastModelDigest=chunks[-1]["modelDigest"],
        chunkManifestSha256=hashlib.sha256(
            json.dumps(chunks, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest(),
        fullResultSha256=sha(result_path),
        supervisor={k: v for k, v in supervisor.items() if k != "command"},
    )
    for record in item["findings"].values():
        record["dependencies"] = list(dict.fromkeys(record["dependencies"]))
    f = forcing()
    item["series"]["offeredCapM3s"] = [((q * 2 // 5 * 19 // 20) // 5 // 2000) * 2000 / 86400000 for q in f["boundaryL"]]
    item["series"]["irrigationRequestM3s"] = [q / 86400000 for q in f["requestL"]]
    item["series"]["requestM3s"] = item["series"]["irrigationRequestM3s"]
    item["series"]["unmetRequestM3s"] = [
        q - d for q, d in zip(item["series"]["requestM3s"], item["series"]["C1M3s"], strict=True)
    ]
    series = item["series"]
    old = base["series"]
    seconds = 86400
    totals = {
        "grossDiversionM3": sum(series["C1M3s"]) * seconds,
        "consumptionM3": sum(series["consumptionM3s"]) * seconds,
        "returnM3": sum(series["D1M3s"]) * seconds,
        "outletM3": sum(series["R2bM3s"]) * seconds,
        "parentPriorityOutletM3": sum(old["R2bM3s"]) * seconds,
        "extraEcologicalShortfallM3": item["findings"]["ecological"]["shortfallVolumeM3"]
        - base["findings"]["ecological"]["shortfallVolumeM3"],
    }
    if abs(totals["extraEcologicalShortfallM3"] - totals["consumptionM3"]) > 1e-5:
        raise ValueError("Additional ecological deficit is not accounted by consumption")
    limitations = [
        "Illustrative up-to20% gross irrigation share, daily cap rounded down to2m3; not an adopted rule, recommended percentage or protected-use ranking",
        "No domestic or industrial demand, life-safety reserve or safety-floor claim",
        "The original ecological schedule/reference remain unchanged; a met issued instruction can coexist with an ecological deficit",
        "50% of irrigation diversion is consumed; the rest returns the same day carrying all diverted salt; no soil/storage/mobilisation model",
        "Lower flow in R2a is not repaired there by D1 returns joining farther downstream at R2b",
        "Same-day conditional deliverability is after committed diversion, not a sustainable basin optimum",
        "365daily means stitched from122 runs of3days or less; no subdaily-extrema or continuous-native-year claim",
        "Same synthetic model assumptions as parent:5% natural mixed sink, no groundwater physics, travel-time or thermal simulation",
        "No ecological-status or legal-fault conclusion follows from these synthetic results",
    ]
    allocation = {
        "id": "drought-sharing",
        "version": ISSUED_VERSION,
        "grossDiversionFraction": 0.2,
        "consumptionFraction": 0.5,
        "returnTiming": "same day",
        "formula": "Each day: min(irrigation-request volume, floor((daily river volume after5% natural exchange /5)/2m3)×2m3, actual available volume); daily volumes become meanm3/s by dividing86400seconds",
        "capQuantizationM3": 2,
        "capRounding": "down; less than2m3/day below exact20% offered share",
        "limits": limitations[:2],
    }
    payload = {
        "schemaVersion": "eflow-guided/1",
        "datasetId": DATASET,
        "metadata": {
            "status": "admitted",
            "synthetic": True,
            "period": copy.deepcopy(parent["metadata"]["period"]),
            "timeSupport": parent["metadata"]["timeSupport"],
            "versions": item["provenance"]["software"],
            "physicsVersion": VERSION,
            "limitations": limitations,
            "sourceManifest": {
                p.name: sha(p)
                for p in (
                    model_path,
                    base_path,
                    Path(__file__).with_name("run_sharing.py"),
                    Path(__file__),
                    Path(__file__).with_name("uv.lock"),
                )
            },
        },
        "dates": copy.deepcopy(parent["dates"]),
        "waterBodies": copy.deepcopy(parent["waterBodies"]),
        "network": copy.deepcopy(parent["network"]),
        "reference": copy.deepcopy(parent["reference"]),
        "method": copy.deepcopy(parent["method"]),
        "allocationPolicy": allocation,
        "scenarios": {SCENARIO: item},
        "comparison": {
            "parentDatasetId": parent["datasetId"],
            "parentPayloadSha256": sha(parent_path),
            "naturalScenarioId": "dry-natural",
            "priorityScenarioId": "dry-managed",
            "referenceVersion": parent["reference"]["version"],
            "checkpoint": "R2b",
            "mappingVersion": "guided-map-v1",
            "totals": totals,
            "interpretation": "Under identical drought, irrigation receives water and downstream ecological deficit grows by consumptive use; the ecological target was not lowered.",
        },
        "admission": {
            "annualComplete": True,
            "nativeScenarioCount": 1,
            "annualWallSeconds": supervisor["elapsedSeconds"],
            "chunkEquivalence": json.loads((audit / "repair_chunk_admission.json").read_text()),
            "independentSmokeReview": json.loads((audit.parent / "REPAIR_SMOKE_INDEPENDENT.json").read_text()),
            "sourcePolicy": "Additive files only; original native model and parent payload retained bytewise",
        },
    }
    output.mkdir(parents=True, exist_ok=True)
    write(output / "guided-sharing.json", payload)
    (output / "guided-sharing.js").write_text(
        "window.EflowGuidedSharing = " + json.dumps(payload, separators=(",", ":"), allow_nan=False) + ";\n"
    )
    return payload


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--audit", type=Path, required=True)
    p.add_argument("--parent", type=Path, default=Path("../data/guided.json"))
    p.add_argument("--output", type=Path, default=Path("../data"))
    a = p.parse_args()
    build(a.audit, a.parent, a.output)


if __name__ == "__main__":
    main()
