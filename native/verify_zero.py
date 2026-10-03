"""Bounded native zero-flow evidence case; zero delivery is not missing evidence."""

import argparse
from pathlib import Path
from guided_model import forcing, simulate, write


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    f = forcing()
    f["boundaryL"][:3] = [0, 0, 0]
    result = simulate(f, False, False, 0, 3, 3, a.output)
    assert result["series"]["R2bM3s"] == [0, 0, 0]
    assert result["saltMgL"]["R2b"] == [None, None, None]
    assert result["findings"]["ecological"]["daily"] == ["shortfall"] * 3
    assert result["findings"]["issued"]["daily"] == ["met"] * 3
    write(
        a.output / "zero_admission.json",
        {
            "status": "passed",
            "days": 3,
            "actualNativeZero": True,
            "positiveEcologicalCriterion": "three shortfalls",
            "zeroIssuedCriterion": "three met",
            "dryConcentration": None,
            "missingDataSubstituted": False,
            "limitations": "Explicit zero-boundary short evidence case, not an annual scenario",
        },
    )


if __name__ == "__main__":
    main()
