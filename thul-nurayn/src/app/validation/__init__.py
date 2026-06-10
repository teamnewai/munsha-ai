"""THUL-NURAYN v1 — D14 paper-validation reporting & measurement layer.

Read-only analytics over persisted paper data (D14_PAPER_VALIDATION_ARCHITECTURE.md):
  * compute_validation_metrics / ValidationReport — the full metric set (reuses D6).
  * ValidationReporter — daily/weekly/monthly period reports (existing
    performance_records) + cumulative ValidationReport.
  * ValidationThresholds / GateResult / evaluate — read-only Pass/Fail eligibility
    against the owner validation policy.

Measures only; changes nothing. No recommendation engine, no auto-tuning (D14A —
out of scope). PostgreSQL is the source of truth; all reports are reproducible.
"""

from .gate import GateResult, ValidationThresholds, evaluate
from .metrics import Breakdown, ValidationReport, compute_validation_metrics
from .report import ValidationReporter

__all__ = [
    "compute_validation_metrics",
    "ValidationReport",
    "Breakdown",
    "ValidationReporter",
    "ValidationThresholds",
    "GateResult",
    "evaluate",
]
