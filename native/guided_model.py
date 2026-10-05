"""Native synthetic six-unit teaching network and an independent integer oracle."""

from __future__ import annotations

import hashlib
import json
import logging
import math
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta
from decimal import Decimal
from fractions import Fraction
from importlib import metadata
from pathlib import Path
from time import perf_counter
from uuid import NAMESPACE_URL, uuid5

import incidence
import polars as pl
from fishy.duties import Delivery, DutyApplicability, Obligation, SuppliedDuty, assess_duty
from fishy.evidence import CorrectionState, ProductionMethod, Provenance
from fishy.physical import ExchangeView, PhysicalProjection, TimeInterpretation
from fishy.quantities import Flow
from fishy.spatial import CalculationSection, Location, Reach, WaterBody
from taqsim import (
    Composition,
    ConservationQuantum,
    ConservativeTransport,
    Constituent,
    ConstituentInput,
    IntervalVolume,
    LocationMapping,
    MassCounts,
    Remobilisation,
    RunMetadata,
    TimeAxis,
    WaterSystem,
    WaterVolume,
)
from taqsim.vocabulary import RuleContext, RulePlan, divide, subtract

LOG = logging.getLogger(__name__)
DATASET = "guided-six-unit-synthetic-v1"
VERSION = "guided-physics-v1"
LITRES_PER_DAY_M3S = 86_400_000
CAPACITY_L = 5_000_000_000
NAMES = ("R1", "intake", "C1", "irrigation", "D1", "S1", "R2a", "R2b")
SALT = Constituent("salt", "generic conservative dissolved salt", "generic salt mass", Decimal("0.000001"))


def write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False, default=str) + "\n")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def versions() -> dict[str, object]:
    return {
        name: {
            "version": metadata.version(name),
            "source": json.loads(metadata.distribution(name).read_text("direct_url.json") or "null"),
        }
        for name in ("taqsim", "fishy", "incidence", "polars")
    }


def forcing() -> dict[str, object]:
    days = range(365)
    raw = [0.3 + 2.2 * math.exp(-0.5 * ((d - 155) / 39) ** 2) for d in days]
    scale = 5 / (sum(raw) / 365)
    # Imported sources use multiples of200 m3: exact binary whole-m3 admission,5% loss and40% dry scaling.
    boundary = [round(q * scale * LITRES_PER_DAY_M3S / 200_000) * 200_000 for q in raw]
    reference = [q * 19 // 20 for q in boundary]
    factors = [Fraction(8, 5) - Fraction(6, 5) * y / 99 for y in range(100)]
    rank = Fraction(75, 100) * 101
    lower = int(rank)
    factor = factors[lower - 1] + (factors[lower] - factors[lower - 1]) * (rank - lower)
    # Round teaching instruction upward to even cubic metres; retain exact fractional operands.
    ecological = [2000 * math.ceil(Fraction(q) * factor / 2000) for q in reference]
    requests = [
        2000 * round(max(0, math.sin(math.pi * (d - 80) / 220)) * 3 * LITRES_PER_DAY_M3S / 2000) if 80 < d < 300 else 0
        for d in days
    ]
    return {
        "dates": [(date(2025, 1, 1) + timedelta(days=d)).isoformat() for d in days],
        "boundaryL": boundary,
        "referenceL": reference,
        "ecologicalL": ecological,
        "requestL": requests,
        "recordYears": 100,
        "annualFactors": [float(f) for f in factors],
        "shiftFactor": float(factor),
        "basis": "100 hypothetical pointwise-ordered years: boundary×(1.6−1.2y/99); rank p×101; 50% annual class maps to75%. Memoryless natural routing retains95% at R2b. No accepted reconstruction or statutory Q347 determination.",
    }


def oracle(
    f: dict[str, object], managed: bool, dry: bool, start: int, stop: int, initial_l: int = 0
) -> list[dict[str, int]]:
    """Independent integer mass balance, computed before native execution."""
    storage = initial_l
    rows = []
    for d in range(start, stop):
        source = f["boundaryL"][d] * (2 if dry else 5) // 5
        loss = source // 20
        river = source - loss
        target = f["ecologicalL"][d]
        diversion = min(f["requestL"][d], max(0, river - target)) if managed else 0
        returned = diversion // 2
        consumed = diversion - returned
        before = storage
        available = storage + river - diversion
        spill = max(0, available - CAPACITY_L) if managed else 0
        release = min(available - spill, target) if managed else available
        storage = available - spill - release
        delivered = spill + release + returned
        deliverable = available + returned
        issued = min(target, deliverable)
        rows.append(
            {
                "day": d,
                "sourceL": source,
                "naturalLossL": loss,
                "R1L": river,
                "C1L": diversion,
                "D1L": returned,
                "consumptionL": consumed,
                "S1inL": river - diversion,
                "storageStartL": before,
                "storageL": storage,
                "spillL": spill,
                "releaseL": release,
                "R2aL": spill + release,
                "R2bL": delivered,
                "deliverableL": deliverable,
                "issuedL": issued,
                "ecologicalL": target,
                "residualL": source + before - loss - consumed - delivered - storage,
                "outletSaltMg": 100 * (spill + release + diversion),
                "storageSaltMg": 100 * storage,
            }
        )
    return rows


def expr_series(context: RuleContext, label: str, counts: tuple[int, ...]) -> object:
    name = f"{context.owner}-{label}"
    context.forcings[name] = [c / 1000 for c in counts]
    return incidence.forcing(name)


def positive(expr: object) -> object:
    return incidence.max(incidence.literal(0), expr)


@dataclass(frozen=True)
class NaturalLoss:
    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        loss = divide(context.available, incidence.literal(20))
        return RulePlan(
            (("loss", "natural_exchange", loss), ("river", downstream, subtract(context.available, loss))),
            "sequential",
            ("mixed", "mixed"),
        )


@dataclass(frozen=True)
class Intake:
    target: tuple[int, ...]
    request: tuple[int, ...]

    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        diversion = incidence.min(
            positive(subtract(context.available, expr_series(context, "reserve", self.target))),
            expr_series(context, "request", self.request),
        )
        return RulePlan(
            (("diversion", "c1", diversion), ("river", downstream, subtract(context.available, diversion))),
            "sequential",
            ("mixed", "mixed"),
        )


@dataclass(frozen=True)
class Irrigation:
    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        consumed = divide(context.available, incidence.literal(2))
        return RulePlan(
            (("consumption", "atmosphere", consumed), ("return", downstream, subtract(context.available, consumed))),
            "sequential",
            ("evaporation", "mixed"),
        )


@dataclass(frozen=True)
class Reservoir:
    target: tuple[int, ...]

    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        spill = positive(subtract(context.available, incidence.literal(CAPACITY_L / 1000)))
        release = incidence.min(subtract(context.available, spill), expr_series(context, "schedule", self.target))
        return RulePlan(
            (("spill", downstream, spill), ("release", downstream, release)), "sequential", ("mixed", "mixed")
        )


def compose(count: int) -> Composition:
    return Composition((ConstituentInput("salt", mass=MassCounts(count)),))


def run_chunk(
    f: dict[str, object],
    managed: bool,
    dry: bool,
    start: int,
    stop: int,
    state: dict[str, tuple[int, int]],
    output: Path,
) -> object:
    expected = oracle(f, managed, dry, start, stop, state.get("S1", (0, 0))[0])
    rows = list(range(start, stop))
    model = WaterSystem(name=VERSION, time=TimeAxis(f["dates"][start], stop - start), quantum=ConservationQuantum.LITRE)
    source = [r["sourceL"] for r in expected]
    frame = pl.DataFrame(
        {"time": [datetime.fromisoformat(f["dates"][d]) for d in rows], "value": [c / 1000 for c in source]}
    )
    model.source("boundary", IntervalVolume(frame, "m3", "1d", "1 L"))
    for name in ("natural_exchange", "atmosphere", "outlet"):
        model.sink(name)
    target = tuple(f["ecologicalL"][d] for d in rows)
    requests = tuple(f["requestL"][d] if managed else 0 for d in rows)
    declarations = (
        ("R1", "boundary", "intake", NaturalLoss()),
        ("intake", "R1", "S1", Intake(target, requests)),
        ("C1", "intake", "irrigation", None),
        ("irrigation", "C1", "D1", Irrigation()),
        ("D1", "irrigation", "R2b", None),
        ("S1", "intake", "R2a", Reservoir(target) if managed else None),
        ("R2a", "S1", "R2b", None),
        ("R2b", "R2a", "outlet", None),
    )
    for name, up, down, rule in declarations:
        model.reach(
            name.lower(),
            up.lower(),
            down.lower(),
            rule=rule,
            initial_water=WaterVolume(state.get(name, (0, 0))[0] / 1000, "m3"),
        )
    model.configure_transport(
        ConservativeTransport(
            (SALT,),
            boundaries={"boundary": tuple(compose(c * 100) for c in source)},
            initial={n.lower(): compose(state.get(n, (0, 0))[1]) for n in NAMES},
            remobilisation={n.lower(): Remobilisation.COMPLETE for n in NAMES},
            metadata=RunMetadata(
                scenario=("dry" if dry else "normal") + "-" + ("managed" if managed else "natural"),
                version=VERSION,
                provenance=("Entirely synthetic teaching network",),
                assumptions=(
                    "Daily instantaneous routing except S1 managed storage; same-day irrigation return",
                    "No ecology calibration, groundwater physics, river travel-time or heat model",
                    "Natural S1 counterpart is explicitly memoryless river, no initial artificial storage",
                ),
            ),
            location_mappings=(LocationMapping("r2b", "R2", "R2b-section", "guided-map-v1"),),
        )
    )
    built = model.build()
    output.mkdir(parents=True, exist_ok=True)
    write(output / "model.json", dict(built.document))
    run = built.run(uuid5(NAMESPACE_URL, f"{DATASET}:{managed}:{dry}:{start}:{stop}"))
    run.save(output / "run.json")
    write(output / "physical.json", run.physical.to_dict())
    return run


def assess(run: object, ecological: list[int], issued: list[int]) -> dict[str, object]:
    provenance = Provenance(
        source="Synthetic native TaqSim checkpoint",
        reference_member="guided-natural-reference-v1",
        scenario=run.physical.metadata["inputs"]["metadata"]["scenario"],
        software_version="Pinned native stack",
        data_version=DATASET,
        configuration_version=VERSION,
        production_method=ProductionMethod.SIMULATED,
        correction_state=CorrectionState.ORIGINAL,
        limitations=(
            "Hypothetical physical evidence; no ecological status or legal fault inferred",
            "Daily means do not establish subdaily minima",
        ),
    )
    loc = Location(Reach("R2b", "1", WaterBody("R2", "1")), CalculationSection("R2b-section", "1"), "guided-map-v1")
    projection = PhysicalProjection(run.physical, loc, "r2b", provenance, ExchangeView.INCOMING, TimeInterpretation.UTC)
    flows = projection.flows()
    output = {}
    for key, counts in (("ecological", ecological), ("issued", issued)):
        schedule = tuple(
            Obligation(
                replace(
                    sample,
                    value=Flow(Fraction(count, LITRES_PER_DAY_M3S)),
                    uncertainty=None,
                    components=(),
                    provenance=replace(
                        sample.provenance,
                        source=f"Frozen synthetic {key} schedule",
                        production_method=ProductionMethod.ILLUSTRATIVE,
                        configuration_version="guided-policy-v1",
                    ),
                ),
                "guided-policy-v1",
            )
            for sample, count in zip(flows, counts, strict=True)
        )
        duty = SuppliedDuty(
            identifier="R2b:" + key,
            version="guided-policy-v1",
            provision="Synthetic " + key + " daily instruction",
            applicability=DutyApplicability.HYPOTHETICAL,
            schedule=schedule,
            search_record="Teaching record, no authority adoption",
        )
        result = assess_duty(duty, tuple(Delivery(s, "guided-native-v1") for s in flows))
        values = [i.numerical.finding.value for i in result.intervals]
        short = [float(i.shortfall.value) for i in result.intervals]
        output[key] = {
            "daily": [
                {"pass": "met", "fail": "shortfall", "unknown": "indeterminate"}.get(v, "not_assessed") for v in values
            ],
            "rawFishy": values,
            "shortfallM3s": short,
            "shortfallDays": sum(v > 0 for v in short),
            "shortfallVolumeM3": float(result.known_shortfall_volume.value),
            "criterionId": duty.identifier,
            "criterionVersion": duty.version,
            "mappingVersion": "guided-map-v1",
            "dependencies": list(projection.attributed_provenance.dependencies),
            "toleranceM3s": 0,
        }
    return output


def simulate(
    f: dict[str, object],
    managed: bool,
    dry: bool,
    start: int,
    stop: int,
    chunk_days: int,
    output: Path,
    initial_l: int = 0,
) -> dict[str, object]:
    started = perf_counter()
    expected = oracle(f, managed, dry, start, stop, initial_l)
    state = {name: ((initial_l, 100 * initial_l) if name == "S1" else (0, 0)) for name in NAMES}
    arrays = {
        key: []
        for key in (
            "boundaryM3s",
            "R1M3s",
            "C1M3s",
            "D1M3s",
            "R2aM3s",
            "R2bM3s",
            "naturalLossM3s",
            "consumptionM3s",
            "storageM3",
            "spillM3s",
            "releaseM3s",
        )
    }
    balances = []
    chunks = []
    findings = {
        key: {
            "daily": [],
            "rawFishy": [],
            "shortfallM3s": [],
            "shortfallDays": 0,
            "shortfallVolumeM3": 0,
            "dependencies": [],
        }
        for key in ("ecological", "issued")
    }
    salt = {name: [] for name in ("R1", "C1", "D1", "R2a", "R2b")}
    for first in range(start, stop, chunk_days):
        end = min(first + chunk_days, stop)
        path = output / f"chunk-{first:03d}"
        oldstate = state.copy()
        run = run_chunk(f, managed, dry, first, end, state, path)
        physical = run.physical
        if any(b.residual != 0 for b in (*physical.balances, *physical.basin_balances)):
            raise AssertionError("Native nonzero or missing balance")
        for local, d in enumerate(range(first, end)):
            row = expected[d - start]
            for name, want in (
                ("intake", row["R1L"]),
                ("C1", row["C1L"]),
                ("D1", row["D1L"]),
                ("S1", row["S1inL"]),
                ("R2a", row["R2aL"]),
                ("R2b", row["R2bL"]),
                ("natural_exchange", row["naturalLossL"]),
                ("atmosphere", row["consumptionL"]),
            ):
                got = physical.sample(name.lower(), local, view="incoming").water_count
                if got != want:
                    raise AssertionError(f"Oracle water mismatch day{d} {name}: native{got} expected{want}")
            for name in NAMES:
                want = row["storageL"] if name == "S1" else 0
                sample = physical.sample(name.lower(), local, view="storage")
                if sample.water_count != want or sample.mass_counts["salt"] != want * 100:
                    raise AssertionError(f"Oracle inventory mismatch day{d} {name}")
            outlet = physical.sample("outlet", local, view="incoming")
            if outlet.mass_counts["salt"] != row["outletSaltMg"]:
                raise AssertionError(f"Oracle outlet salt mismatch day{d}")
            for name in salt:
                sample = physical.sample("intake" if name == "R1" else name.lower(), local, view="incoming")
                salt[name].append(None if not sample.water_count else sample.mass_counts["salt"] / sample.water_count)
            mapping = {
                "boundaryM3s": "sourceL",
                "R1M3s": "R1L",
                "C1M3s": "C1L",
                "D1M3s": "D1L",
                "R2aM3s": "R2aL",
                "R2bM3s": "R2bL",
                "naturalLossM3s": "naturalLossL",
                "consumptionM3s": "consumptionL",
                "spillM3s": "spillL",
                "releaseM3s": "releaseL",
            }
            for key, rkey in mapping.items():
                arrays[key].append(row[rkey] / LITRES_PER_DAY_M3S)
            arrays["storageM3"].append(row["storageL"] / 1000)
            balances.append(row["residualL"])
        fishy = assess(
            run,
            [r["ecologicalL"] for r in expected[first - start : end - start]],
            [r["issuedL"] for r in expected[first - start : end - start]],
        )
        for key, part in fishy.items():
            for field in ("daily", "rawFishy", "shortfallM3s", "dependencies"):
                findings[key][field].extend(part[field])
            for field in ("shortfallDays", "shortfallVolumeM3"):
                findings[key][field] += part[field]
            for field in ("criterionId", "criterionVersion", "mappingVersion", "toleranceM3s"):
                findings[key][field] = part[field]
        state = {
            name: (
                physical.storage[name.lower()][-1].water_count,
                physical.storage[name.lower()][-1].mass_counts["salt"],
            )
            for name in NAMES
        }
        chunks.append(
            {
                "start": f["dates"][first],
                "startIndex": first,
                "days": end - first,
                "modelDigest": run.model_digest,
                "runDigest": run.authoritative_log_digest,
                "initialCounts": oldstate,
                "finalCounts": state,
                "physicalPath": str(path.relative_to(output) / "physical.json"),
            }
        )
        LOG.info(
            "%s/%s days%d-%d admitted", "dry" if dry else "normal", "managed" if managed else "natural", first, end
        )
    result = {
        "id": ("dry" if dry else "normal") + "-" + ("managed" if managed else "natural"),
        "name": ("Dry" if dry else "Normal") + " forcing · " + ("managed system" if managed else "natural counterpart"),
        "forcing": "dry" if dry else "normal",
        "configuration": "managed" if managed else "natural",
        "status": "passed",
        "dates": f["dates"][start:stop],
        "series": arrays,
        "saltMgL": salt,
        "deliverableM3s": [r["deliverableL"] / LITRES_PER_DAY_M3S for r in expected],
        "criteria": {
            "ecologicalM3s": [r["ecologicalL"] / LITRES_PER_DAY_M3S for r in expected],
            "issuedM3s": [r["issuedL"] / LITRES_PER_DAY_M3S for r in expected],
        },
        "findings": findings,
        "balances": {
            "dailyResidualCounts": balances,
            "maxResidualCounts": max(map(abs, balances), default=0),
            "dailyResidualM3": [r / 1000 for r in balances],
            "maxResidualM3": max(map(abs, balances), default=0) / 1000,
            "initialStorageM3": initial_l / 1000,
            "finalStorageM3": arrays["storageM3"][-1],
            "waterQuantumM3": 0.001,
            "saltQuantumKg": 1e-6,
            "nativeWaterSaltResidualCounts": 0,
            "independentOracleComparisons": len(expected) * 18,
        },
        "provenance": {
            "datasetId": DATASET,
            "physicsVersion": VERSION,
            "policyVersion": "guided-policy-v1",
            "nativeExecution": "stitched daily-state runs" if chunk_days < stop - start else "continuous native run",
            "chunkDays": chunk_days,
            "chunks": chunks,
            "runtimeSeconds": perf_counter() - started,
            "software": versions(),
            "sourceSha256": sha(Path(__file__)),
            "forcingSha256": hashlib.sha256(json.dumps(f, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
            "seriesBasis": "Native values independently matched exactly to integer oracle before exported oracle values are admitted",
            "deliverabilityBasis": "Prospective same-day upper bound conditional on already-committed current diversion, current reservoir water, inflow and return; unlimited outlet, no dead storage or future carryover requirement. Not a sustainable or basin-wide bound. Issued=min(ecological,same-day bound).",
            "eventOrder": "R1 mixed5% natural exchange; reserve-aware diversion; irrigation50% water-only ET and same-dayreturn; S1 current inflow added, spill above5Mm3 before target release; R2a plus D1 mix at R2b; close end inventories.",
        },
    }
    write(output / "oracle.json", expected)
    write(output / "result.json", result)
    return result
