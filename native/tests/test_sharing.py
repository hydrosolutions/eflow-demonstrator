"""Behavior and actual-payload checks for the additive drought policy."""

import json
from pathlib import Path

from sharing_model import forcing, oracle


def test_drought_sharing_serves_demand_without_changing_ecological_need():
    f = forcing()
    rows = oracle(f, True, True, 0, 365)
    assert [r["ecologicalL"] for r in rows] == f["ecologicalL"]
    assert all(r["residualL"] == 0 for r in rows)
    assert all(r["C1L"] <= f["requestL"][r["day"]] and 5 * r["C1L"] <= r["R1L"] for r in rows)
    assert any(r["C1L"] > 0 for r in rows)
    assert any(0 < r["C1L"] == f["requestL"][r["day"]] < r["R1L"] / 5 for r in rows)
    assert any(r["C1L"] == r["offeredCapL"] < f["requestL"][r["day"]] for r in rows)
    assert all(r["offeredCapL"] <= r["R1L"] / 5 < r["offeredCapL"] + 2000 for r in rows)
    assert all(r["C1L"] == r["consumptionL"] + r["D1L"] for r in rows)
    assert all(r["storageL"] == 0 for r in rows)
    assert all(r["R2bL"] == r["R1L"] - r["consumptionL"] for r in rows)


def test_native_payload_keeps_parent_reference_and_kind_specific_fishy_versions():
    root = Path(__file__).parents[2]
    parent = json.loads((root / "data/guided.json").read_text())
    addon = json.loads((root / "data/guided-sharing.json").read_text())
    s = addon["scenarios"]["dry-managed-sharing"]
    assert addon["reference"] == parent["reference"] and addon["method"] == parent["method"]
    assert addon["dates"] == parent["dates"] == s["dates"]
    assert s["series"]["boundaryM3s"] == parent["scenarios"]["dry-managed"]["series"]["boundaryM3s"]
    assert s["findings"]["ecological"]["criterionVersion"] == "guided-policy-v1"
    assert s["findings"]["issued"]["criterionVersion"] == "guided-sharing-20pct-v1"
    assert s["criteria"]["ecologicalM3s"] == parent["method"]["ecologicalM3s"]
    assert s["balances"]["maxResidualCounts"] == s["balances"]["nativeWaterSaltResidualCounts"] == 0
    assert s["findings"]["ecological"]["shortfallDays"] == 365
    assert s["findings"]["issued"]["shortfallDays"] == 0
    assert sum(s["series"]["C1M3s"]) > 0
