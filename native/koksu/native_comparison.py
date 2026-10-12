"""Actual native routing of monthly-curve-derived boundary flows through an illustrative network."""
from __future__ import annotations

import argparse
import csv
from dataclasses import asdict, dataclass, replace
from datetime import date, datetime, timedelta
from decimal import Decimal
from fractions import Fraction
import hashlib
from importlib import metadata
import json
import logging
import math
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import incidence
import polars as pl
from fishy.duties import Delivery, DutyApplicability, Obligation, SuppliedDuty, assess_duty
from fishy.evidence import CorrectionState, ProductionMethod, Provenance
from fishy.physical import ExchangeView, PhysicalProjection, TimeInterpretation
from fishy.quantities import Flow
from fishy.spatial import CalculationSection, Location, Reach, WaterBody
from taqsim import Composition, ConservationQuantum, ConservativeTransport, Constituent, ConstituentInput, IntervalVolume, LocationMapping, MassCounts, Remobilisation, RunMetadata, TimeAxis, WaterSystem, WaterVolume
from taqsim.vocabulary import RuleContext, RulePlan, divide, subtract

from native_contracts import Candidate, DailyLedger, Forcing, Policy, ScenarioResult

LOG = logging.getLogger(__name__)
DAY = 86_400_000
NAMES = ("r1", "intake", "c1", "irrigation", "d1", "s1", "r2a", "r2b")
MODEL = "koksu-allocation-priority-network-v1"


def save(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False, default=str) + "\n")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def versions() -> dict[str, object]:
    return {name: {"version": metadata.version(name), "source": json.loads(metadata.distribution(name).read_text("direct_url.json") or "null")} for name in ("fishy", "taqsim", "incidence", "polars")}


def load_forcing(path: Path, year: int, expected_sha256: str) -> Forcing:
    if digest(path) != expected_sha256:
        raise ValueError("source hash mismatch")
    with path.open() as stream:
        rows = [row for row in csv.DictReader(stream) if row["Date"].startswith(f"{year}-")]
    dates = tuple(date.fromisoformat(row["Date"]) for row in rows)
    expected = tuple(date(year, 1, 1) + timedelta(days=i) for i in range((date(year + 1, 1, 1) - date(year, 1, 1)).days))
    if dates != expected or len(dates) != 365:
        raise ValueError("source requires complete ordered 365-day calendar")
    values = tuple(Decimal(row["Q_m3s"]) * DAY for row in rows)
    if any(not q.is_finite() or q < 0 or q != int(q) or int(q) % 20 for q in values):
        raise ValueError("source counts must be finite nonnegative exact litres divisible by20")
    requests = tuple(2000 * round(max(0, math.sin(math.pi * (i - 80) / 220)) * 3 * DAY / 2000) if 80 < i < 300 else 0 for i in range(365))
    return Forcing(year, dates, tuple(int(q) for q in values), requests, expected_sha256)


def load_candidate(path: Path, method: str, forcing: Forcing, policy: Policy) -> Candidate:
    document = json.loads(path.read_text(), parse_float=Decimal)
    if document.get("reference", {}).get("sourceSha256") != forcing.source_sha256:
        raise ValueError("candidate reference source hash mismatch")
    settings = document["methods"][method]
    raw = tuple(Fraction(str(q)) for q in settings["dailyM3sByYear"][str(forcing.year)])
    if len(raw) != len(forcing.dates):
        raise ValueError("candidate calendar length mismatch")
    if any(q < 0 for q in raw):
        raise ValueError("negative candidate")
    counts = tuple(policy.target_quantum_litres * math.ceil(q * DAY / policy.target_quantum_litres) for q in raw)
    return Candidate(method, forcing.year, raw, counts, str(settings.get("version", f"koksu-{method}-conditional-v1")), digest(path), settings.get("provenance", {}))


def independent_ledger(forcing: Forcing, candidate: Candidate, policy: Policy, managed: bool) -> tuple[DailyLedger, ...]:
    storage = policy.initial_storage_litres if managed else 0
    output = []
    for day, boundary, request, target in zip(forcing.dates, forcing.boundary_litres, forcing.request_litres, candidate.target_litres, strict=True):
        loss = boundary // policy.natural_loss_divisor
        river = boundary - loss
        allocable = max(0, river - target) if policy.priority == "ecology-first" else river
        diversion = min(request, allocable // policy.allocation_quantum_litres * policy.allocation_quantum_litres) if managed else 0
        returned = diversion // policy.return_divisor
        consumed = diversion - returned
        available = storage + river - diversion
        spill = max(0, available - policy.capacity_litres) if managed else 0
        issued = min(target, river) if managed else 0
        release = min(available - spill, max(0, target - spill)) if managed else available
        downstream = release + spill + returned
        end = available - spill - release
        residual = boundary + storage - loss - consumed - downstream - end
        output.append(DailyLedger(day.isoformat(), boundary, request, loss, diversion, returned, consumed, storage, spill, release, downstream, release + spill, end, target if managed else 0, issued, residual))
        storage = end
    return tuple(output)


def water_m3(count: int) -> float:
    """Project exact litre counts using Taqsim's public canonical quantum."""
    if type(count) is not int or not 0 <= count <= 2**53:
        raise ValueError("water count must be a nonnegative integer at most2**53")
    return float(count) * ConservationQuantum.LITRE.quantum_m3


def series(context: RuleContext, name: str, counts: tuple[int, ...]) -> object:
    identity = f"{context.owner}-{name}"
    context.forcings[identity] = [water_m3(c) for c in counts]
    return incidence.forcing(identity)


def exact_litre_request(value: object) -> object:
    """Nearest-litre projection for requests proven integral in native litre counts."""
    return incidence.add(value, incidence.literal(ConservationQuantum.LITRE.quantum_m3 / 2))


def positive(value: object) -> object:
    return incidence.max(incidence.literal(0), value)


@dataclass(frozen=True)
class NaturalLoss:
    divisor: int

    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        removed = divide(context.available, incidence.literal(self.divisor))
        return RulePlan((("loss", "natural_exchange", exact_litre_request(removed)), ("through", downstream, exact_litre_request(subtract(context.available, removed)))), "sequential", ("mixed", "mixed"))


@dataclass(frozen=True)
class Intake:
    requests: tuple[int, ...]
    caps: tuple[int, ...]

    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        diverted = incidence.min(context.available, incidence.min(series(context, "request", self.requests), series(context, "cap", self.caps)))
        return RulePlan((("diversion", "c1", exact_litre_request(diverted)), ("through", downstream, exact_litre_request(subtract(context.available, diverted)))), "sequential", ("mixed", "mixed"))


@dataclass(frozen=True)
class Irrigation:
    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        consumed = divide(context.available, incidence.literal(2))
        return RulePlan((("consumption", "atmosphere", exact_litre_request(consumed)), ("return", downstream, exact_litre_request(subtract(context.available, consumed)))), "sequential", ("evaporation", "mixed"))


@dataclass(frozen=True)
class Reservoir:
    targets: tuple[int, ...]
    capacity: int

    def compile(self, context: RuleContext, downstream: str) -> RulePlan:
        spill = positive(subtract(context.available, incidence.literal(water_m3(self.capacity))))
        remainder = positive(subtract(series(context, "target", self.targets), spill))
        release = incidence.min(subtract(context.available, spill), remainder)
        return RulePlan((("spill", downstream, exact_litre_request(spill)), ("release", downstream, exact_litre_request(release))), "sequential", ("mixed", "mixed"))


def native_chunk(forcing: Forcing, candidate: Candidate, policy: Policy, first: int, stop: int, storage: int, managed: bool, output: Path) -> object:
    boundary = forcing.boundary_litres[first:stop]
    requests = forcing.request_litres[first:stop] if managed else (0,) * len(boundary)
    # Memoryless source/target admission cap, not simulated/oracle output.
    rivers = tuple(b - b // policy.natural_loss_divisor for b in boundary)
    caps = tuple((max(0, r - e) if policy.priority == "ecology-first" else r) // policy.allocation_quantum_litres * policy.allocation_quantum_litres for r, e in zip(rivers, candidate.target_litres[first:stop], strict=True))
    model = WaterSystem(name=MODEL, time=TimeAxis(forcing.dates[first], stop - first), quantum=ConservationQuantum.LITRE)
    frame = pl.DataFrame({"time": [datetime.combine(d, datetime.min.time()) for d in forcing.dates[first:stop]], "value": [water_m3(b) for b in boundary]})
    model.source("boundary", IntervalVolume(frame, "m3", "1d", "1 L"))
    for name in ("natural_exchange", "atmosphere", "outlet"):
        model.sink(name)
    declarations = (("r1", "boundary", "intake", NaturalLoss(policy.natural_loss_divisor)), ("intake", "r1", "s1", Intake(requests, caps)), ("c1", "intake", "irrigation", None), ("irrigation", "c1", "d1", Irrigation()), ("d1", "irrigation", "r2b", None), ("s1", "intake", "r2a", Reservoir(candidate.target_litres[first:stop], policy.capacity_litres) if managed else None), ("r2a", "s1", "r2b", None), ("r2b", "r2a", "outlet", None))
    for name, up, down, rule in declarations:
        model.reach(name, up, down, rule=rule, initial_water=WaterVolume(water_m3(storage) if name == "s1" else 0, "m3"))
    zero = Composition((ConstituentInput("inert", mass=MassCounts(0)),))
    model.configure_transport(ConservativeTransport((Constituent("inert", "zero accounting tracer", "inert", Decimal("0.000001")),), boundaries={"boundary": (zero,) * len(boundary)}, initial={name: zero for name in NAMES}, remobilisation={name: Remobilisation.COMPLETE for name in NAMES}, metadata=RunMetadata(scenario=f"{forcing.year}-{candidate.method if managed else 'natural'}", version=MODEL, provenance=("Published Koksu monthly curve derived daily steps; hypothetical network",), assumptions=("No calibrated naturalisation or habitat model", f"{policy.priority}; no20%cap; same-day50%return;5Mm3 hypothetical storage; R2a release target")), location_mappings=tuple(LocationMapping(section, "R2", section.upper().replace("R2A", "R2a").replace("R2B", "R2b") + "-section", "koksu-map-v1") for section in ("r2a", "r2b"))))
    built = model.build()
    save(output / "model.json", dict(built.document))
    run = built.run(uuid5(NAMESPACE_URL, f"{MODEL}:{forcing.source_sha256}:{candidate.target_sha256}:{candidate.method}:{forcing.year}:{managed}:{policy.priority}:{first}:{stop}:{storage}"))
    run.save(output / "run.json")
    save(output / "physical.json", run.physical.to_dict())
    return run


def assess(run: object, rows: tuple[DailyLedger, ...], candidate: Candidate, section: str = "r2b") -> dict[str, object]:
    provenance = Provenance(source="Actual native Taqsim routing of monthly-curve-derived Koksu illustration", reference_member="published-koksu-monthly-proxy-v1", scenario=run.physical.metadata["inputs"]["metadata"]["scenario"], software_version="Pinned native stack", data_version=candidate.target_sha256, configuration_version=MODEL, production_method=ProductionMethod.SIMULATED, correction_state=CorrectionState.ORIGINAL, limitations=("Candidate illustration; no official ecological status or legal finding", "Daily mean does not establish daily extrema"))
    label = "R2a" if section == "r2a" else "R2b"
    location = Location(Reach(label, "1", WaterBody("R2", "1")), CalculationSection(label + "-section", "1"), "koksu-map-v1")
    projection = PhysicalProjection(run.physical, location, section, provenance, ExchangeView.INCOMING, TimeInterpretation.UTC)
    flows = projection.flows()
    result = {}
    for name, field in (("candidate", "candidate_litres"), ("issued", "issued_litres")):
        version = candidate.criterion_version + ":" + name
        schedule = tuple(Obligation(replace(sample, value=Flow(Fraction(getattr(row, field), DAY)), uncertainty=None, components=(), provenance=replace(sample.provenance, source="Explicit hypothetical " + name + " schedule", production_method=ProductionMethod.ILLUSTRATIVE, configuration_version=version)), version) for sample, row in zip(flows, rows, strict=True))
        duty = SuppliedDuty(identifier=label + ":" + name, version=version, provision="Illustrative conditional " + name, applicability=DutyApplicability.HYPOTHETICAL, schedule=schedule, search_record="No authority adoption; controlled demonstrator")
        assessed = assess_duty(duty, tuple(Delivery(flow, MODEL) for flow in flows))
        values = [i.numerical.finding.value for i in assessed.intervals]
        shortfalls = [float(i.shortfall.value) for i in assessed.intervals]
        result[name] = {"rawFishy": values, "shortfallM3s": shortfalls, "shortfallDays": sum(q > 0 for q in shortfalls), "shortfallVolumeM3": float(assessed.known_shortfall_volume.value), "criterionId": duty.identifier, "criterionVersion": duty.version, "applicability": "hypothetical"}
    return result


def simulate(forcing: Forcing, candidate: Candidate, policy: Policy, output: Path, chunk_days: int, managed: bool = True) -> ScenarioResult:
    if chunk_days < 1 or len(forcing.dates) != len(candidate.target_litres):
        raise ValueError("invalid chunk or candidate calendar length")
    if policy.priority not in ("ecology-first", "irrigation-first"):
        raise ValueError("unknown allocation priority")
    expected = independent_ledger(forcing, candidate, policy, managed)
    storage = policy.initial_storage_litres if managed else 0
    rows, chunks = [], []
    sections = {section: {key: {"rawFishy": [], "shortfallM3s": [], "shortfallDays": 0, "shortfallVolumeM3": 0} for key in ("candidate", "issued")} for section in ("r2a", "r2b")}
    for first in range(0, len(forcing.dates), chunk_days):
        stop = min(first + chunk_days, len(forcing.dates))
        path = output / f"chunk-{first:03d}"
        run = native_chunk(forcing, candidate, policy, first, stop, storage, managed, path)
        physical = run.physical
        balances = (*physical.balances, *physical.basin_balances)
        if not balances or any(b.residual != 0 for b in balances):
            raise AssertionError("Native balance missing or nonzero")
        initial = storage
        chunk_rows = []
        for local, i in enumerate(range(first, stop)):
            def incoming(name: str) -> int:
                return physical.sample(name, local, view="incoming").water_count
            boundary, loss, diversion, returned, consumed, downstream = (incoming(name) for name in ("r1", "natural_exchange", "c1", "d1", "atmosphere", "r2b"))
            end = physical.sample("s1", local, view="storage").water_count
            available = storage + incoming("s1")
            spill = max(0, available - policy.capacity_litres) if managed else 0
            release = incoming("r2a") - spill
            issued = min(candidate.target_litres[i], boundary - loss) if managed else 0
            row = DailyLedger(forcing.dates[i].isoformat(), boundary, forcing.request_litres[i], loss, diversion, returned, consumed, storage, spill, release, downstream, incoming("r2a"), end, candidate.target_litres[i] if managed else 0, issued, boundary + storage - loss - consumed - downstream - end)
            if row != expected[i]:
                raise AssertionError(f"Independent ledger mismatch day{i}: native{row}; oracle{expected[i]}")
            for name in NAMES:
                inventory = physical.sample(name, local, view="storage")
                if inventory.water_count != (end if name == "s1" else 0) or inventory.mass_counts["inert"] != 0:
                    raise AssertionError(f"Unexpected native inventory {name} day{i}")
            chunk_rows.append(row)
            storage = end
        if managed:
            for section, findings in sections.items():
                assessment = assess(run, tuple(chunk_rows), candidate, section)
                for name, part in assessment.items():
                    for field in ("rawFishy", "shortfallM3s"):
                        findings[name][field].extend(part[field])
                    for field in ("shortfallDays", "shortfallVolumeM3"):
                        findings[name][field] += part[field]
                    for field in ("criterionId", "criterionVersion", "applicability"):
                        findings[name][field] = part[field]
        rows.extend(chunk_rows)
        chunks.append({"first": first, "stop": stop, "initialStorageLitres": initial, "finalStorageLitres": storage, "maxNativeResidualLitres": 0, "maxTransitStorageLitres": 0, "nativeBalanceCount": len(balances), "modelDigest": run.model_digest, "runDigest": run.authoritative_log_digest, "physicalSha256": digest(path / "physical.json"), "path": str(path)})
        LOG.info("%s %s admitted %s-%s", forcing.year, candidate.method if managed else "natural", first, stop)
    if managed:
        for section, findings in sections.items():
            for kind, field in (("candidate", "candidate_litres"), ("issued", "issued_litres")):
                actual_field = "r2a_litres" if section == "r2a" else "downstream_litres"
                deficits = [max(0, getattr(row, field) - getattr(row, actual_field)) for row in rows]
                if findings[kind]["rawFishy"] != ["fail" if q else "pass" for q in deficits] or abs(findings[kind]["shortfallVolumeM3"] - sum(deficits) / 1000) > 1e-8:
                    raise AssertionError("Independent Fishy comparison mismatch")
                findings[kind]["shortfallVolumeM3"] = sum(deficits) / 1000
    provenance = {"comparisonMode": candidate.provenance.get("comparisonMode", "year-matched"), "forcingInterpretation": "Published monthly Koksu curve expanded as daily steps;2011/2021 are calendar alignment codes, not observed years;dry is an assumed50% scaling", "model": MODEL, "policy": asdict(policy), "sourceSha256": forcing.source_sha256, "targetSha256": candidate.target_sha256, "dates": [d.isoformat() for d in forcing.dates], "candidateM3s": [q / DAY for q in candidate.target_litres], "rawCandidateM3s": [float(q) for q in candidate.raw_m3s], "candidateProvenance": candidate.provenance, "versions": versions(), "nativeExecution": "Complete annual sequence of state-carrying chunks" if len(forcing.dates) == 365 else "Bounded witness", "moduleSha256": digest(Path(__file__))}
    result = ScenarioResult(forcing.year, candidate.method if managed else "natural", managed, tuple(rows), sections["r2b"] if managed else {}, sections["r2a"] if managed else {}, tuple(chunks), provenance)
    save(output / "result.json", asdict(result))
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--targets", type=Path, required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--method", choices=("natural", "swiss", "kazakh", "site"), required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--priority", choices=("ecology-first", "irrigation-first"), default="ecology-first")
    parser.add_argument("--mode", default="year-matched")
    args = parser.parse_args()
    expected_source = json.loads(args.targets.read_text())["reference"]["sourceSha256"]
    forcing = load_forcing(args.source, args.year, expected_source)
    policy = Policy(priority=args.priority)
    candidate = load_candidate(args.targets, "swiss" if args.method == "natural" else args.method, forcing, policy)
    candidate = replace(candidate, provenance={**candidate.provenance, "comparisonMode": args.mode})
    simulate(forcing, candidate, policy, args.output, chunk_days=3, managed=args.method != "natural")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
