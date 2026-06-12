"""THUL-NURAYN v1 — D3 component engines (Master §3, §8).

Relative Strength · Breakout Detection · RVOL · PEAD Integration.
Each exposes eligibility (gate) checks and a deterministic point award in
[0, weight]. Two-tier components award full weight at the boost level and
BASE_AWARD_FRACTION × weight at the minimum threshold. Pure / deterministic.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from . import constants as C
from .facts import BreakoutFacts, EarningsFacts


def _base(weight: Decimal) -> Decimal:
    return weight * C.BASE_AWARD_FRACTION


class RelativeStrengthEngine:
    """RS ≥ 80 gate; full award at RS ≥ 90 (Master §3, §12)."""

    def eligible(self, rs_rating: Decimal) -> bool:
        return rs_rating >= C.RS_MIN

    def points(self, rs_rating: Decimal) -> Decimal:
        if rs_rating >= C.RS_BOOST:
            return C.W_CORE_RS
        if rs_rating >= C.RS_MIN:
            return _base(C.W_CORE_RS)
        return Decimal("0")


class BreakoutDetectionEngine:
    """52-week-high or base-high (≥50d) breakout (Master §3, §12)."""

    def eligible(self, b: BreakoutFacts) -> bool:
        return self._is_base(b) or b.new_52w_high

    def _is_base(self, b: BreakoutFacts) -> bool:
        return b.base_breakout and b.base_days >= C.BASE_HIGH_MIN_DAYS

    def points(self, b: BreakoutFacts) -> Decimal:
        if b.new_52w_high:
            return C.W_CORE_BREAKOUT
        if self._is_base(b):
            return _base(C.W_CORE_BREAKOUT)
        return Decimal("0")


class RVOLEngine:
    """Core: ≥1.5 gate, full at ≥2.0. Turbo: ≥3.0 gate (Master §3)."""

    def core_eligible(self, rvol: Decimal) -> bool:
        return rvol >= C.RVOL_CORE_MIN

    def core_points(self, rvol: Decimal) -> Decimal:
        if rvol >= C.RVOL_CORE_BOOST:
            return C.W_CORE_RVOL
        if rvol >= C.RVOL_CORE_MIN:
            return _base(C.W_CORE_RVOL)
        return Decimal("0")

    def turbo_eligible(self, rvol: Decimal) -> bool:
        return rvol >= C.RVOL_TURBO_MIN

    def turbo_points(self, rvol: Decimal) -> Decimal:
        return C.W_TURBO_RVOL if rvol >= C.RVOL_TURBO_MIN else Decimal("0")


class PEADIntegrationLayer:
    """Complementary earnings layer — NOT a gate (Master §3, §7)."""

    def points(self, earnings: Optional[EarningsFacts]) -> Decimal:
        if (
            earnings is not None
            and earnings.surprise_positive
            and earnings.aligned
            and earnings.days_since <= C.PEAD_MAX_DAYS
        ):
            return C.W_CORE_PEAD
        return Decimal("0")


__all__ = [
    "RelativeStrengthEngine",
    "BreakoutDetectionEngine",
    "RVOLEngine",
    "PEADIntegrationLayer",
]
