"""THUL-NURAYN v1 — P-DATA Replay/Fixture provider (first cut).

Deterministic, network-free provider that replays pre-built fixture frames
(P_DATA_MARKET_DATA_ARCHITECTURE.md §3, §11; readiness-review fastest path).
It parses pre-computed fact VALUES into the frozen D3 DTOs and runs the
data-quality gate — it does NOT compute live indicators (the live FactsBuilder
is a FUTURE concern behind the provider ABC). No live vendor, no broker, no
TradingView, no IBKR.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Callable, Optional, Sequence

from src.enums import Direction
from src.selection.facts import (
    BreakoutFacts,
    CoreCandidateInput,
    EarningsFacts,
    MarketFacts,
    TurboCandidateInput,
)

from .frame import MarketDataFrame
from .provider import MarketDataProvider
from .quality import validate_frame


def _dec(v) -> Optional[Decimal]:
    if v is None:
        return None
    return v if isinstance(v, Decimal) else Decimal(str(v))


def _build_market_facts(spec: Optional[dict]) -> Optional[MarketFacts]:
    if spec is None:
        return None
    return MarketFacts(
        spy_price=_dec(spec.get("spy_price")),
        spy_sma_200=_dec(spec.get("spy_sma_200")),
        adx=_dec(spec.get("adx")),
    )


def _build_core(spec: dict) -> CoreCandidateInput:
    bd = spec.get("breakout") or {}
    ea = spec.get("earnings")
    return CoreCandidateInput(
        symbol=spec["symbol"],
        direction=Direction(spec["direction"]),
        rs_rating=_dec(spec["rs_rating"]),
        rvol=_dec(spec["rvol"]),
        adv=int(spec["adv"]),
        trend_stage2=bool(spec["trend_stage2"]),
        breakout=BreakoutFacts(
            new_52w_high=bool(bd.get("new_52w_high", False)),
            base_breakout=bool(bd.get("base_breakout", False)),
            base_days=int(bd.get("base_days", 0)),
        ),
        earnings=(
            None
            if ea is None
            else EarningsFacts(
                surprise_positive=bool(ea.get("surprise_positive", False)),
                days_since=int(ea.get("days_since", 999)),
                aligned=bool(ea.get("aligned", False)),
            )
        ),
    )


def _build_turbo(spec: dict) -> TurboCandidateInput:
    return TurboCandidateInput(
        symbol=spec["symbol"],
        direction=Direction(spec["direction"]),
        rvol=_dec(spec["rvol"]),
        adv=int(spec["adv"]),
        atr=_dec(spec["atr"]),
        premarket_volume=int(spec["premarket_volume"]),
        gap_pct=_dec(spec["gap_pct"]),
        above_vwap=bool(spec["above_vwap"]),
        catalyst=bool(spec.get("catalyst", False)),
        orb_confirmed=bool(spec.get("orb_confirmed", False)),
        momentum_ok=bool(spec.get("momentum_ok", False)),
    )


class ReplayMarketDataProvider(MarketDataProvider):
    """Replays a finite, ordered sequence of fixture frame-specs deterministically."""

    def __init__(
        self,
        specs: Sequence[dict],
        *,
        clock: Optional[Callable[[], datetime]] = None,
        max_age_sec: Optional[float] = None,
    ) -> None:
        self._specs = list(specs)
        self._idx = 0
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._max_age_sec = max_age_sec
        self._seen_bar_ids: set = set()

    def exhausted(self) -> bool:
        return self._idx >= len(self._specs)

    def poll(self) -> MarketDataFrame:
        if self.exhausted():
            raise StopIteration("replay provider exhausted")
        spec = self._specs[self._idx]
        self._idx += 1
        return self._build_frame(spec)

    def _build_frame(self, spec: dict) -> MarketDataFrame:
        captured_at = spec["captured_at"]
        if not isinstance(captured_at, datetime):
            captured_at = datetime.fromisoformat(str(captured_at))
        bar_id = spec.get("bar_id") or captured_at.isoformat()
        is_dup = bar_id in self._seen_bar_ids
        self._seen_bar_ids.add(bar_id)

        market_open = bool(spec.get("market_open", True))
        market_facts = _build_market_facts(spec.get("market_facts"))
        core = tuple(_build_core(s) for s in spec.get("core", []))
        turbo = tuple(_build_turbo(s) for s in spec.get("turbo", []))
        marks = {sym: _dec(px) for sym, px in (spec.get("marks") or {}).items()}

        report, kept_core, kept_turbo = validate_frame(
            captured_at=captured_at,
            market_open=market_open,
            market_facts=market_facts,
            core=core,
            turbo=turbo,
            marks=marks,
            is_duplicate_bar=is_dup,
            now=self._clock(),
            max_age_sec=self._max_age_sec,
        )

        # Withhold market_facts on a fatal frame (no inferred/fabricated facts).
        emitted_facts = market_facts if report.valid else None

        return MarketDataFrame(
            captured_at=captured_at,
            market_open=market_open,
            market_facts=emitted_facts,
            core_candidates=kept_core,
            turbo_candidates=kept_turbo,
            marks=marks,
            quality=report,
            bar_id=bar_id,
        )


__all__ = ["ReplayMarketDataProvider"]
