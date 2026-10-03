"""Application evidence checks against the actual generated browser payload."""

import json
from pathlib import Path

DATA = Path(__file__).parents[2] / "data" / "guided.json"


def test_native_replay_keeps_ecological_and_issued_findings_separate():
    data = json.loads(DATA.read_text())
    target = data["method"]["ecologicalM3s"]
    for key, s in data["scenarios"].items():
        assert s["dates"] == data["dates"] and len(s["dates"]) == 365
        assert s["criteria"]["ecologicalM3s"] == target
        assert s["provenance"]["datasetId"] == data["datasetId"]
        assert s["criteria"]["referenceVersion"] == data["reference"]["version"]
        assert s["criteria"]["checkpoint"] == data["method"]["checkpoint"] == "R2b"
        assert s["balances"]["maxResidualCounts"] == 0
        assert s["findings"]["issued"]["shortfallDays"] == 0
        assert s["findings"]["ecological"]["shortfallDays"] == (365 if key.startswith("dry-") else 0)
    assert data["shortfallCase"]["findings"]["issued"]["shortfallDays"] == 3
    assert data["admission"]["zeroFlowEvidence"]["positiveEcologicalCriterion"] == "three shortfalls"


def test_natural_counterpart_and_dry_difference_match_independent_closed_form():
    d = json.loads(DATA.read_text())
    for prefix in ("normal", "dry"):
        natural = d["scenarios"][prefix + "-natural"]
        s = natural["series"]
        assert all(abs(out - 0.95 * source) < 1e-12 for out, source in zip(s["R2bM3s"], s["boundaryM3s"], strict=True))
        assert sum(s["C1M3s"]) == sum(s["D1M3s"]) == sum(s["storageM3"]) == 0
    for normal, dry in zip(
        d["scenarios"]["normal-natural"]["series"]["R2bM3s"],
        d["scenarios"]["dry-natural"]["series"]["R2bM3s"],
        strict=True,
    ):
        assert abs(dry - 0.4 * normal) < 1e-12
    wetland = next(w for w in d["waterBodies"] if w["id"] == "W1")
    assert wetland["origin"] == "natural" and wetland["track"] == "natural/status" and wetland["receptor"]
