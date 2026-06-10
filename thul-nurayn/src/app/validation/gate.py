"""THUL-NURAYN v1 — D14 validation Pass/Fail gate (read-only eligibility).

Read-only evaluation of a `ValidationReport` against the owner-approved
validation thresholds (P-VALIDATION §5). This is **eligibility measurement**, not
a recommendation engine and not auto-tuning: it compares metrics to owner-set
governance thresholds and reports pass/fail per criterion. It changes nothing.

Thresholds are governance config (distinct from D4 risk gates).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from .metrics import ValidationReport


@dataclass(frozen=True)
class ValidationThresholds:
    """Owner-approved validation policy (eligibility gates)."""

    min_duration_days: int = 30
    min_trades: int = 200
    min_win_rate: Decimal = Decimal("0.85")
    min_profit_factor: Decimal = Decimal("2.0")
    max_drawdown_limit: Decimal = Decimal("-0.10")   # drawdown must be >= this
    require_positive_return: bool = True
    require_recovery: bool = True
    min_regimes: int = 2
    require_long_and_short: bool = True


@dataclass(frozen=True)
class GateResult:
    """Pass/Fail outcome with per-criterion detail (transient)."""

    passed: bool
    criteria: dict = field(default_factory=dict)   # name -> (passed: bool, detail: str)

    @property
    def failures(self) -> tuple:
        return tuple(name for name, (ok, _) in self.criteria.items() if not ok)


def evaluate(
    report: ValidationReport,
    thresholds: ValidationThresholds | None = None,
) -> GateResult:
    """Evaluate a report against the thresholds. Read-only; no side effects."""
    t = thresholds or ValidationThresholds()
    c: dict = {}

    c["duration"] = (
        report.span_days >= t.min_duration_days,
        f"span_days={report.span_days} (>= {t.min_duration_days})",
    )
    c["trades"] = (
        report.trades >= t.min_trades,
        f"trades={report.trades} (>= {t.min_trades})",
    )
    c["win_rate"] = (
        report.win_rate >= t.min_win_rate,
        f"win_rate={report.win_rate} (>= {t.min_win_rate})",
    )
    # profit factor: None means no losses -> pass iff there is gross profit
    if report.profit_factor is None:
        pf_ok = report.gross_profit > Decimal("0")
        pf_detail = "profit_factor=inf (no losses)" if pf_ok else "no profit, no losses"
    else:
        pf_ok = report.profit_factor >= t.min_profit_factor
        pf_detail = f"profit_factor={report.profit_factor} (>= {t.min_profit_factor})"
    c["profit_factor"] = (pf_ok, pf_detail)

    c["max_drawdown"] = (
        report.max_drawdown >= t.max_drawdown_limit,
        f"max_drawdown={report.max_drawdown} (>= {t.max_drawdown_limit})",
    )
    c["positive_return"] = (
        (report.portfolio_return > Decimal("0")) if t.require_positive_return else True,
        f"portfolio_return={report.portfolio_return} (> 0)",
    )
    c["recovery"] = (
        (report.recovered) if t.require_recovery else True,
        f"recovered={report.recovered}",
    )
    c["regimes"] = (
        len(report.regimes_observed) >= t.min_regimes,
        f"regimes_observed={list(report.regimes_observed)} (>= {t.min_regimes})",
    )
    c["long_and_short"] = (
        (report.long_tested and report.short_tested) if t.require_long_and_short else True,
        f"long={report.long_tested} short={report.short_tested}",
    )

    passed = all(ok for ok, _ in c.values())
    return GateResult(passed=passed, criteria=c)


__all__ = ["ValidationThresholds", "GateResult", "evaluate"]
