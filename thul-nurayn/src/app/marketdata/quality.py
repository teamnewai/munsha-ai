"""THUL-NURAYN v1 — P-DATA data-quality validation.

Validates a frame's inputs BEFORE they reach scoring/risk
(P_DATA_MARKET_DATA_ARCHITECTURE.md §8). The five failure types
(Missing Price · Invalid Volume · Duplicate Bar · Stale Data · Market Closed)
are detected here; fatal issues withhold the whole frame (P-ORCH then Rejects
the Cycle). Per-candidate issues drop that candidate. No fabricated data is ever
substituted.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from src.selection.facts import (
    CoreCandidateInput,
    MarketFacts,
    TurboCandidateInput,
)

from .frame import (
    DUPLICATE_BAR,
    INVALID_VOLUME,
    MARKET_CLOSED,
    MISSING_PRICE,
    QualityReport,
    STALE_DATA,
)


def _finite_positive(value: Optional[Decimal]) -> bool:
    return (
        isinstance(value, Decimal)
        and value.is_finite()
        and value > Decimal("0")
    )


def validate_frame(
    *,
    captured_at: datetime,
    market_open: bool,
    market_facts: Optional[MarketFacts],
    core: tuple,
    turbo: tuple,
    marks: dict,
    is_duplicate_bar: bool,
    now: datetime,
    max_age_sec: Optional[float],
) -> tuple[QualityReport, tuple, tuple]:
    """Validate one frame. Returns (report, kept_core, kept_turbo).

    Fatal issues (market closed, duplicate bar, stale, missing SPY/regime price)
    set `valid=False` and the frame is withheld by the consumer. Per-candidate
    issues (missing mark / invalid volume) drop only that candidate.
    """
    fatal: list[str] = []

    # -- fatal, frame-level --------------------------------------------- #
    if not market_open:
        fatal.append(MARKET_CLOSED)
    if is_duplicate_bar:
        fatal.append(DUPLICATE_BAR)
    if max_age_sec is not None:
        age = (now - captured_at).total_seconds()
        if age > max_age_sec:
            fatal.append(STALE_DATA)
    # SPY/regime price must be present and a finite positive number
    if (
        market_facts is None
        or not _finite_positive(market_facts.spy_price)
        or not _finite_positive(market_facts.spy_sma_200)
    ):
        fatal.append(MISSING_PRICE)

    # -- per-candidate (drop on issue; never fabricate) ----------------- #
    dropped: list[tuple] = []
    kept_core: list[CoreCandidateInput] = []
    kept_turbo: list[TurboCandidateInput] = []

    for c in core:
        reason = _candidate_issue(c.symbol, c.adv, marks)
        if reason:
            dropped.append((c.symbol, reason))
        else:
            kept_core.append(c)

    for t in turbo:
        reason = _candidate_issue(t.symbol, t.adv, marks, premarket_volume=t.premarket_volume)
        if reason:
            dropped.append((t.symbol, reason))
        else:
            kept_turbo.append(t)

    report = QualityReport(
        valid=not fatal,
        fatal_issues=tuple(fatal),
        dropped=tuple(dropped),
    )
    return report, tuple(kept_core), tuple(kept_turbo)


def _candidate_issue(
    symbol: str,
    adv: int,
    marks: dict,
    *,
    premarket_volume: Optional[int] = None,
) -> Optional[str]:
    """Return a drop-reason for a candidate, or None if acceptable."""
    mark = marks.get(symbol)
    if not _finite_positive(mark):
        return MISSING_PRICE
    if not isinstance(adv, int) or adv <= 0:
        return INVALID_VOLUME
    if premarket_volume is not None and (
        not isinstance(premarket_volume, int) or premarket_volume < 0
    ):
        return INVALID_VOLUME
    return None


__all__ = ["validate_frame"]
