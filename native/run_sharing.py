"""Bounded CLI for the single additive sharing scenario."""

import argparse
import logging
from pathlib import Path

from sharing_model import forcing, simulate, write


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--start", type=int, default=0)
    p.add_argument("--days", type=int, default=365)
    p.add_argument("--chunk-days", type=int, default=3)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    if not 0 <= a.start < a.start + a.days <= 365:
        raise ValueError("Scenario interval must fit the synthetic365-day year")
    f = forcing()
    write(a.output / "forcing.json", f)
    simulate(f, True, True, a.start, a.start + a.days, a.chunk_days, a.output)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    main()
