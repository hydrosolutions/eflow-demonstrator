from dataclasses import replace
from datetime import date, timedelta
from fractions import Fraction
from pathlib import Path

import pytest

from native_contracts import Candidate, Forcing, Policy
from native_quality import simulate_quality


def witness(boundary: tuple[int, ...] = (200000,), target: int = 76000, request: int = 152000, storage: int = 0) -> tuple[Forcing, Candidate, Policy]:
    dates = tuple(date(2011, 1, 1) + timedelta(days=i) for i in range(len(boundary)))
    forcing = Forcing(2011, dates, boundary, (request,) * len(dates), "witness")
    candidate = Candidate("swiss", 2011, (Fraction(target, 86400000),) * len(dates), (target,) * len(dates), "witness", "witness", {})
    return forcing, candidate, Policy(initial_storage_litres=storage)


def test_return_restores_quantity_but_can_fail_salt(tmp_path: Path) -> None:
    forcing, candidate, policy = witness()
    result = simulate_quality(forcing, candidate, replace(policy, priority="irrigation-first"), tmp_path, 1)
    assert result["sections"]["r2a"]["concentrationMgL"] == [180]
    assert result["drain"]["concentrationMgL"] == [360]
    assert result["sections"]["r2b"]["concentrationMgL"] == [300]
    assert result["sections"]["r2b"]["rawFishy"] == ["fail"]
    assert result["quantity"]["r2b"]["issued"]["rawFishy"] == ["pass"]
    assert result["quantity"]["r2a"]["issued"]["rawFishy"] == ["fail"]
    assert result["balances"]["maxAbsoluteSaltResidualMg"] == 0
    assert result["balances"]["maxAbsoluteWaterResidualLitres"] == 0


@pytest.mark.parametrize(("background", "finding"), [(250, "pass"), (251, "fail")])
def test_inclusive_quality_threshold_uses_native_fishy(tmp_path: Path, background: int, finding: str) -> None:
    forcing, candidate, policy = witness(request=0)
    result = simulate_quality(forcing, candidate, policy, tmp_path, 1, background_mg_l=background)
    assert result["sections"]["r2a"]["rawFishy"] == [finding]


def test_dry_concentration_is_undefined_and_quality_unknown(tmp_path: Path) -> None:
    forcing, candidate, policy = witness(boundary=(0,), target=0, request=0)
    result = simulate_quality(forcing, candidate, policy, tmp_path, 1)
    for section in result["sections"].values():
        assert section["concentrationMgL"] == [None]
        assert section["saltKgDay"] == [0]
        assert section["rawFishy"] == ["unknown"]


def test_full_mass_and_water_state_survive_chunk_handoff(tmp_path: Path) -> None:
    forcing, candidate, policy = witness(boundary=(171072000, 171072000, 0, 342144000, 171072000, 0), target=55080000, request=100000000, storage=2835616800)
    whole = simulate_quality(forcing, candidate, policy, tmp_path / "whole", 6)
    chunks = simulate_quality(forcing, candidate, policy, tmp_path / "chunks", 3)
    for field in ("ledger", "sections", "drain", "quantity"):
        assert whole[field] == chunks[field]
    assert chunks["chunks"][0]["finalInventory"] == chunks["chunks"][1]["initialInventory"]
    assert chunks["chunks"][0]["finalInventory"]["s1"]["saltMg"] > 0


def test_no_diversion_preserves_background_in_both_sections(tmp_path: Path) -> None:
    forcing, candidate, policy = witness(request=0)
    result = simulate_quality(forcing, candidate, policy, tmp_path, 1)
    assert result["drain"]["flowM3s"] == [0]
    assert result["drain"]["concentrationMgL"] == [None]
    for section in result["sections"].values():
        assert section["concentrationMgL"] == [180]
        assert section["rawFishy"] == ["pass"]
