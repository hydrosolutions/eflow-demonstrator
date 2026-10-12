"""Reproducible CLI; supervisor enforces the agreed execution budgets."""

import argparse
import logging
from pathlib import Path
from guided_model import forcing, simulate, write


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--scenario", required=True, choices=("normal-natural", "normal-managed", "dry-natural", "dry-managed")
    )
    p.add_argument("--start", type=int, default=0)
    p.add_argument("--days", type=int, default=365)
    p.add_argument("--chunk-days", type=int, default=3)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--initial-storage-m3", type=int, default=0)
    a = p.parse_args()
    if not 0 <= a.start < a.start + a.days <= 365:
        raise ValueError("Scenario interval must fit synthetic365day year")
    f = forcing()
    write(a.output / "forcing.json", f)
    simulate(
        f,
        a.scenario.endswith("-managed"),
        a.scenario.startswith("dry-"),
        a.start,
        a.start + a.days,
        a.chunk_days,
        a.output,
        a.initial_storage_m3 * 1000,
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
