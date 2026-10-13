"""Conservative teaching salt on the unchanged Koksu allocation network."""
from __future__ import annotations

import argparse
from dataclasses import asdict, replace
from datetime import datetime
from decimal import Decimal
from fractions import Fraction
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import polars as pl
from fishy.evidence import CorrectionState, ProductionMethod, Provenance
from fishy.duties import Delivery, DutyApplicability, Obligation, SuppliedDuty, assess_duty
from fishy.flows import Presence
from fishy.physical import ExchangeView, PhysicalProjection, TimeInterpretation
from fishy.quality import ChemicalBehavior, ChemicalIdentity, Comparison, ObservationKind, ProfileStatus, QualityBounds, QualityObservation, QualityProfile, QualityTarget, QualityValue, assess_quality
from fishy.spatial import CalculationSection, Location, Reach, WaterBody
from fishy.quantities import Flow
from taqsim import Composition, ConservationQuantum, ConservativeTransport, Constituent, ConstituentInput, IntervalVolume, LocationMapping, MassCounts, Remobilisation, RunMetadata, TimeAxis, WaterSystem, WaterVolume

from native_comparison import DAY, NAMES, Intake, Irrigation, NaturalLoss, Reservoir, digest, independent_ledger, load_candidate, load_forcing, save, versions, water_m3
from native_contracts import Candidate, Forcing, Policy

MODEL = "koksu-conservative-salt-v1"
SALT = Constituent("salt", "generic conservative dissolved salt", "generic salt mass", Decimal("0.000001"))


def composition(mass_mg: int) -> Composition:
    return Composition((ConstituentInput("salt", mass=MassCounts(mass_mg)),))


def native_chunk(forcing: Forcing, candidate: Candidate, policy: Policy, first: int, stop: int, state: dict[str, dict[str, int]], output: Path, background_mg_l: int) -> object:
    boundary = forcing.boundary_litres[first:stop]
    rivers = tuple(b - b // policy.natural_loss_divisor for b in boundary)
    caps = tuple((max(0, r - e) if policy.priority == "ecology-first" else r) // policy.allocation_quantum_litres * policy.allocation_quantum_litres for r, e in zip(rivers, candidate.target_litres[first:stop], strict=True))
    model = WaterSystem(name=MODEL, time=TimeAxis(forcing.dates[first], stop-first), quantum=ConservationQuantum.LITRE)
    frame = pl.DataFrame({"time": [datetime.combine(d, datetime.min.time()) for d in forcing.dates[first:stop]], "value": [water_m3(b) for b in boundary]})
    model.source("boundary", IntervalVolume(frame, "m3", "1d", "1 L"))
    for name in ("natural_exchange", "atmosphere", "outlet"):
        model.sink(name)
    declarations = (("r1", "boundary", "intake", NaturalLoss(policy.natural_loss_divisor)), ("intake", "r1", "s1", Intake(forcing.request_litres[first:stop], caps)), ("c1", "intake", "irrigation", None), ("irrigation", "c1", "d1", Irrigation()), ("d1", "irrigation", "r2b", None), ("s1", "intake", "r2a", Reservoir(candidate.target_litres[first:stop], policy.capacity_litres)), ("r2a", "s1", "r2b", None), ("r2b", "r2a", "outlet", None))
    for name, up, down, rule in declarations:
        model.reach(name, up, down, rule=rule, initial_water=WaterVolume(water_m3(state[name]["waterLitres"]), "m3"))
    model.configure_transport(ConservativeTransport((SALT,), boundaries={"boundary": tuple(composition(b * background_mg_l) for b in boundary)}, initial={name: composition(state[name]["saltMg"]) for name in NAMES}, remobilisation={name: Remobilisation.COMPLETE for name in NAMES}, metadata=RunMetadata(scenario=f"{forcing.year}-{candidate.method}-{policy.priority}", version=MODEL, provenance=("Published monthly Koksu flow proxy; hypothetical original-demonstrator salt assumptions",), assumptions=(f"Background{background_mg_l}mg/L; illustrative250mg/L daily mean limit", "50% irrigation water consumption; all diverted salt returns same day; no additional loads or soil mobilisation", "Quantity routing unchanged; no quality-derived flow requirement")), location_mappings=tuple(LocationMapping(section, "R2", label + "-section", "koksu-map-v1") for section, label in (("r2a", "R2a"), ("r2b", "R2b")))))
    built = model.build()
    save(output / "model.json", dict(built.document))
    identity = json.dumps([MODEL, forcing.source_sha256, candidate.target_sha256, candidate.method, forcing.year, asdict(policy), first, stop, state, background_mg_l], sort_keys=True)
    run = built.run(uuid5(NAMESPACE_URL, identity))
    run.save(output / "run.json")
    save(output / "physical.json", run.physical.to_dict())
    return run


def quality_projection(run: object, section: str, candidate: Candidate) -> PhysicalProjection:
    label = "R2a" if section == "r2a" else "R2b"
    location = Location(Reach(label, "1", WaterBody("R2", "1")), CalculationSection(label + "-section", "1"), "koksu-map-v1")
    provenance = Provenance(source="Native Taqsim conservative salt with hypothetical180mg/L background", scenario=run.physical.metadata["inputs"]["metadata"]["scenario"], reference_member="published-koksu-monthly-proxy-v1", software_version="Pinned native stack", data_version=candidate.target_sha256, configuration_version=MODEL, production_method=ProductionMethod.SIMULATED, correction_state=CorrectionState.ORIGINAL, limitations=("Assumed chemistry and illustrative criterion, not measured Koksu chemistry or an adopted standard", "Daily means do not establish daily extrema; no quality-flow requirement sizing"))
    return PhysicalProjection(run.physical, location, section, provenance, ExchangeView.INCOMING, TimeInterpretation.UTC)


def assess_daily_quality(projection: PhysicalProjection, step: int) -> tuple[str, str]:
    sample = projection.constituent("salt", chemical_form=SALT.chemical_form, reporting_basis=SALT.reporting_basis, start=step, stop=step+1)
    chemical = ChemicalIdentity("salt", SALT.chemical_form, SALT.reporting_basis, "dissolved", ChemicalBehavior.CONSERVATIVE)
    bounds = None
    if sample.presence is Presence.PRESENT:
        value = QualityValue(sample.concentration_kg_m3, "kg/m3")
        bounds = QualityBounds(value, value, "Exact native arithmetic", "Hypothetical inputs; scientific uncertainty unquantified")
    observation = QualityObservation(identifier=f"{projection.model_location}:salt:{step}", chemical=chemical, bounds=bounds, location=sample.location, interval=sample.interval, basis="interval mean", presence=sample.presence, provenance=sample.provenance, kind=ObservationKind.MODEL, support="Native conservative salt", domain="Calculation section", reasons=sample.reasons)
    target = QualityTarget("salt-limit", chemical, Comparison.LE, QualityValue(Fraction(1, 4), "kg/m3"), "interval mean", "Illustrative250mg/L upper criterion; not adopted or ecological status")
    profile = QualityProfile(identifier=projection.model_location + ":salt", version=MODEL, jurisdiction="synthetic", instrument="teaching scenario", instrument_version=MODEL, category="generic conservative salt", purpose="screen", location=sample.location, interval=sample.interval, scenario=sample.provenance.scenario, status=ProfileStatus.SCENARIO, required=("salt-limit",), targets=(target,), applicability="Hypothetical daily mean", uncertainty_policy="Exact model arithmetic; scientific uncertainty unquantified", interpretation="Inclusive hypothetical upper concentration bound")
    raw = assess_quality(profile, (observation,)).results[0].check.finding.value
    return ("unknown" if sample.presence is not Presence.PRESENT else raw), raw


def assess_quantity(projection: PhysicalProjection, rows: tuple, candidate: Candidate) -> dict[str, object]:
    flows = projection.flows()
    result = {}
    for kind, field in (("candidate", "candidate_litres"), ("issued", "issued_litres")):
        version = candidate.criterion_version + ":" + kind
        schedule = tuple(Obligation(replace(sample, value=Flow(Fraction(getattr(row, field), DAY)), uncertainty=None, components=(), provenance=replace(sample.provenance, source="Explicit hypothetical " + kind + " schedule", production_method=ProductionMethod.ILLUSTRATIVE, configuration_version=version)), version) for sample, row in zip(flows, rows, strict=True))
        duty = SuppliedDuty(identifier=projection.model_location + ":" + kind, version=version, provision="Illustrative conditional " + kind, applicability=DutyApplicability.HYPOTHETICAL, schedule=schedule, search_record="No authority adoption; controlled demonstrator")
        assessed = assess_duty(duty, tuple(Delivery(flow, MODEL) for flow in flows))
        shortfalls = [float(interval.shortfall.value) for interval in assessed.intervals]
        result[kind] = {"rawFishy": [interval.numerical.finding.value for interval in assessed.intervals], "shortfallM3s": shortfalls, "shortfallDays": sum(q > 0 for q in shortfalls), "shortfallVolumeM3": float(assessed.known_shortfall_volume.value)}
    return result


def simulate_quality(forcing: Forcing, candidate: Candidate, policy: Policy, output: Path, chunk_days: int, background_mg_l: int = 180) -> dict[str, object]:
    if chunk_days < 1 or len(forcing.dates) != len(candidate.target_litres):
        raise ValueError("invalid chunk or candidate calendar length")
    if policy.priority not in ("ecology-first", "irrigation-first") or policy.return_divisor != 2:
        raise ValueError("unsupported quality allocation policy")
    if type(background_mg_l) is not int or background_mg_l < 0:
        raise ValueError("background must be nonnegative integer mg/L")
    expected = independent_ledger(forcing, candidate, policy, True)
    state = {name: {"waterLitres": policy.initial_storage_litres if name == "s1" else 0, "saltMg": policy.initial_storage_litres * background_mg_l if name == "s1" else 0} for name in NAMES}
    series = {name: {"flowM3s": [], "saltKgDay": [], "concentrationMgL": []} for name in ("r2a", "r2b", "d1")}
    for name in ("r2a", "r2b"):
        series[name].update(rawFishy=[], originalRawFishy=[])
    chunks, quantity = [], {name: {} for name in ("r2a", "r2b")}
    balance_count = 0
    for first in range(0, len(forcing.dates), chunk_days):
        stop = min(first + chunk_days, len(forcing.dates))
        folder = output / f"chunk-{first:03d}"
        initial = state
        run = native_chunk(forcing, candidate, policy, first, stop, state, folder, background_mg_l)
        physical = run.physical
        balances = (*physical.balances, *physical.basin_balances)
        if not balances or any(b.residual for b in balances) or {b.substance for b in balances} != {"water", "salt"}:
            raise AssertionError("Native water/salt balance missing or nonzero")
        balance_count += len(balances)
        projections = {name: quality_projection(run, name, candidate) for name in ("r2a", "r2b")}
        for local, index in enumerate(range(first, stop)):
            row = expected[index]
            water = {"r1": row.boundary_litres, "natural_exchange": row.natural_loss_litres, "c1": row.diversion_litres, "d1": row.return_litres, "atmosphere": row.consumption_litres, "r2a": row.r2a_litres, "r2b": row.downstream_litres}
            mass = {name: count * background_mg_l for name, count in water.items()}
            mass.update(d1=row.diversion_litres * background_mg_l, atmosphere=0, r2b=(row.r2a_litres + row.diversion_litres) * background_mg_l)
            for name, count in water.items():
                sample = physical.sample(name, local, view="incoming")
                if (sample.water_count, sample.mass_counts["salt"]) != (count, mass[name]):
                    raise AssertionError(f"Independent water/salt ledger mismatch {name} day{index}")
            state = {}
            for name in NAMES:
                sample = physical.sample(name, local, view="storage")
                want = row.end_storage_litres if name == "s1" else 0
                if (sample.water_count, sample.mass_counts["salt"]) != (want, want * background_mg_l):
                    raise AssertionError(f"Independent inventory mismatch {name} day{index}")
                state[name] = {"waterLitres": sample.water_count, "saltMg": sample.mass_counts["salt"]}
            for name, values in series.items():
                sample = physical.sample(name, local, view="incoming")
                values["flowM3s"].append(sample.water_count / DAY)
                values["saltKgDay"].append(sample.mass_counts["salt"] / 1_000_000)
                values["concentrationMgL"].append(sample.mass_counts["salt"] / sample.water_count if sample.water_count else None)
                if name in projections:
                    finding, raw = assess_daily_quality(projections[name], local)
                    values["rawFishy"].append(finding)
                    values["originalRawFishy"].append(raw)
                    expected_finding = "unknown" if sample.water_count == 0 else "pass" if sample.mass_counts["salt"] <= 250 * sample.water_count else "fail"
                    if finding != expected_finding:
                        raise AssertionError("Independent quality comparison mismatch")
        for name in quantity:
            findings = assess_quantity(projections[name], expected[first:stop], candidate)
            for kind, part in findings.items():
                destination = quantity[name].setdefault(kind, {"rawFishy": [], "shortfallM3s": [], "shortfallDays": 0, "shortfallVolumeM3": 0})
                for field in ("rawFishy", "shortfallM3s"):
                    destination[field].extend(part[field])
                for field in ("shortfallDays", "shortfallVolumeM3"):
                    destination[field] += part[field]
        chunks.append({"first": first, "stop": stop, "initialInventory": initial, "finalInventory": state, "modelDigest": run.model_digest, "runDigest": run.authoritative_log_digest, "physicalSha256": digest(folder / "physical.json"), "nativeBalanceCount": len(balances), "maxAbsoluteWaterResidualLitres": 0, "maxAbsoluteSaltResidualMg": 0})
    result = {"dates": [d.isoformat() for d in forcing.dates], "ledger": [asdict(r) for r in expected], "sections": {name: series[name] for name in ("r2a", "r2b")}, "drain": series["d1"], "quantity": quantity, "chunks": chunks, "balances": {"maxAbsoluteWaterResidualLitres": 0, "maxAbsoluteSaltResidualMg": 0, "nativeBalanceCount": balance_count, "inventoryHandoffs": len(chunks)-1}, "provenance": {"model": MODEL, "sourceSha256": forcing.source_sha256, "targetSha256": candidate.target_sha256, "policy": asdict(policy), "backgroundSaltMgL": background_mg_l, "versions": versions(), "moduleSha256": digest(Path(__file__)), "waterModuleSha256": digest(Path(__file__).with_name("native_comparison.py")), "qualityFunction": "fishy.quality.assess_quality", "qualityStatus": "scenario", "qualityInterpretation": "Illustrative daily concentration check, not quality-flow requirement sizing or ecological status"}}
    save(output / "result.json", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--targets", type=Path, required=True)
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--method", required=True)
    parser.add_argument("--priority", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    forcing = load_forcing(args.source, args.year, json.loads(args.targets.read_text())["reference"]["sourceSha256"])
    policy = Policy(priority=args.priority)
    candidate = load_candidate(args.targets, args.method, forcing, policy)
    simulate_quality(forcing, candidate, policy, args.output, 3)


if __name__ == "__main__":
    main()
