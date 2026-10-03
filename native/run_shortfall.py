"""Three-day native actuator-error scenario; fixed10/7 targets, actual5 delivery."""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5
import argparse

import incidence
import polars as pl
from taqsim import (
    ConservativeTransport,
    ConservationQuantum,
    IntervalVolume,
    LocationMapping,
    Remobilisation,
    RunMetadata,
    TimeAxis,
    WaterSystem,
)
from taqsim.vocabulary import RulePlan, subtract
from guided_model import SALT, assess, compose, write, LITRES_PER_DAY_M3S, versions


class WrongTurn:
    def compile(self, context: object, downstream: str) -> RulePlan:
        exported = incidence.literal(2 * 86400)
        return RulePlan(
            (
                ("unintended_export", "other_user", exported),
                ("delivery", downstream, subtract(context.available, exported)),
            ),
            "sequential",
            ("mixed", "mixed"),
        )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    days = 3
    dates = [datetime(2025, 7, 1) + timedelta(days=i) for i in range(days)]
    model = WaterSystem(
        name="guided-shortfall-evidence-v1", time=TimeAxis("2025-07-01", days), quantum=ConservationQuantum.LITRE
    )
    model.source(
        "boundary", IntervalVolume(pl.DataFrame({"time": dates, "value": [7.0 * 86400] * days}), "m3", "1d", "1 L")
    )
    model.reach("controller", "boundary", "r2b", rule=WrongTurn())
    model.reach("r2b", "controller", "outlet")
    model.sink("outlet")
    model.sink("other_user")
    model.configure_transport(
        ConservativeTransport(
            (SALT,),
            boundaries={"boundary": tuple(compose(7 * LITRES_PER_DAY_M3S * 100) for _ in dates)},
            initial={n: compose(0) for n in ("controller", "r2b")},
            remobilisation={n: Remobilisation.COMPLETE for n in ("controller", "r2b")},
            metadata=RunMetadata(
                scenario="shortfall-controlled-actuator-error",
                version="guided-physics-v1",
                provenance=("Synthetic3-day native actuator-error evidence",),
                assumptions=(
                    "Instruction fixed before replay; avoidable wrong-turn exports2m3/s",
                    "All7m3/s available can reach checkpoint if the wrong-turn export is disabled",
                ),
            ),
            location_mappings=(LocationMapping("r2b", "R2", "R2b-section", "guided-map-v1"),),
        )
    )
    built = model.build()
    a.output.mkdir(parents=True, exist_ok=True)
    write(a.output / "model.json", dict(built.document))
    run = built.run(uuid5(NAMESPACE_URL, "guided-shortfall-evidence-v1"))
    run.save(a.output / "run.json")
    write(a.output / "physical.json", run.physical.to_dict())
    assert all(b.residual == 0 for b in (*run.physical.balances, *run.physical.basin_balances))
    for t in range(days):
        assert run.physical.sample("r2b", t, view="incoming").water_count == 5 * LITRES_PER_DAY_M3S
        assert run.physical.sample("other_user", t, view="incoming").water_count == 2 * LITRES_PER_DAY_M3S
    findings = assess(run, [10 * LITRES_PER_DAY_M3S] * days, [7 * LITRES_PER_DAY_M3S] * days)
    assert findings["ecological"]["shortfallDays"] == days and findings["issued"]["shortfallDays"] == days
    result = {
        "id": "controlled-shortfall-native-v1",
        "status": "passed",
        "dates": [d.date().isoformat() for d in dates],
        "needM3s": 10,
        "availableM3s": 7,
        "deliverableM3s": 7,
        "issuedM3s": 7,
        "deliveredM3s": 5,
        "naturalGapM3s": 3,
        "deliveryGapM3s": 2,
        "findings": findings,
        "provenance": {
            "nativeModelDigest": run.model_digest,
            "nativeRunDigest": run.authoritative_log_digest,
            "software": versions(),
            "evidenceKind": "separate3-day synthetic native actuator-error replay",
            "nativeWaterSaltResidualCounts": 0,
        },
        "limitations": [
            "Separate scenario and dates; not a changed annual physical output",
            "The missed2m3/s goes to an explicit other-user boundary; the balance closes",
            "All7 can be delivered with unlimited outlet if wrong-turn export is disabled",
            "Ecological need10 and issued7 are supplied teaching assumptions, not adopted legal requirements",
            "Finding prompts investigation; no fault inference from the numbers alone",
        ],
    }
    write(a.output / "result.json", result)
    logging.warning("Native shortfall case passed")


if __name__ == "__main__":
    main()
