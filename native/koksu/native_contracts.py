"""Immutable interfaces for the monthly-curve-derived comparison; no native implementation."""
from dataclasses import dataclass
from datetime import date
from fractions import Fraction
from pathlib import Path


@dataclass(frozen=True)
class Forcing:
    year: int
    dates: tuple[date, ...]
    boundary_litres: tuple[int, ...]
    request_litres: tuple[int, ...]
    source_sha256: str


@dataclass(frozen=True)
class Policy:
    version: str = "allocation-r2a-policy-v1"
    priority: str = "ecology-first"
    capacity_litres: int = 5_000_000_000
    initial_storage_litres: int = 0
    natural_loss_divisor: int = 20
    return_divisor: int = 2
    allocation_quantum_litres: int = 2000
    target_quantum_litres: int = 2000
    checkpoint: str = "r2b"


@dataclass(frozen=True)
class Candidate:
    method: str
    year: int
    raw_m3s: tuple[Fraction, ...]
    target_litres: tuple[int, ...]
    criterion_version: str
    target_sha256: str
    provenance: dict[str, object]


@dataclass(frozen=True)
class RunBudget:
    seconds: int = 300
    rss_bytes: int = 2_147_483_648
    aggregate_seconds: int = 1200


@dataclass(frozen=True)
class DailyLedger:
    date: str
    boundary_litres: int
    request_litres: int
    natural_loss_litres: int
    diversion_litres: int
    return_litres: int
    consumption_litres: int
    start_storage_litres: int
    spill_litres: int
    release_litres: int
    downstream_litres: int
    r2a_litres: int
    end_storage_litres: int
    candidate_litres: int
    issued_litres: int
    residual_litres: int


@dataclass(frozen=True)
class ScenarioResult:
    year: int
    method: str
    managed: bool
    ledger: tuple[DailyLedger, ...]
    fishy_assessment: dict[str, object]
    r2a_fishy_assessment: dict[str, object]
    chunks: tuple[dict[str, object], ...]
    provenance: dict[str, object]
