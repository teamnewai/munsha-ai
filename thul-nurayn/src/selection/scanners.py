"""THUL-NURAYN v1 — D3 Core & Turbo scanners (Master §3, §8, §12–13).

Each scanner is independent (engine tag, A.7). It applies eligibility gates,
computes a /100 score from the §8 weighted components, and classifies the
result. Ineligible candidates are dropped (no ScoredCandidate). Pure /
deterministic — no state, no I/O, no D2 access.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from src.enums import Direction, EngineType, MarketRegime

from . import constants as C
from .components import (
    BreakoutDetectionEngine,
    PEADIntegrationLayer,
    RelativeStrengthEngine,
    RVOLEngine,
)
from .facts import CoreCandidateInput, ScoredCandidate, TurboCandidateInput
from .ranking import classify_score
from .regime import MarketRegimeEngine


class CoreScanner:
    """Core Swing — Long-only, Bull-gated (Master §12)."""

    engine = EngineType.CORE

    def __init__(self) -> None:
        self._regime = MarketRegimeEngine()
        self._rs = RelativeStrengthEngine()
        self._breakout = BreakoutDetectionEngine()
        self._rvol = RVOLEngine()
        self._pead = PEADIntegrationLayer()

    def evaluate(
        self, regime: MarketRegime, c: CoreCandidateInput
    ) -> Optional[ScoredCandidate]:
        # --- eligibility gates (fail -> drop) ---
        if c.direction != Direction.LONG:
            return None                                   # Core is Long-only (v1)
        if not self._regime.allows(regime, c.direction):  # Long requires Bull
            return None
        if c.adv < C.ADV_MIN:                             # liquidity filter
            return None
        if not c.trend_stage2:                            # 50>150>200 structure
            return None
        if not self._rs.eligible(c.rs_rating):            # RS >= 80
            return None
        if not self._rvol.core_eligible(c.rvol):          # RVOL >= 1.5
            return None
        if not self._breakout.eligible(c.breakout):       # 52w / base high
            return None

        # --- scoring (§8) ---
        breakdown = {
            "regime": C.W_CORE_REGIME,
            "relative_strength": self._rs.points(c.rs_rating),
            "breakout": self._breakout.points(c.breakout),
            "rvol": self._rvol.core_points(c.rvol),
            "trend": C.W_CORE_TREND,
            "pead": self._pead.points(c.earnings),
        }
        score = sum(breakdown.values(), Decimal("0"))
        return ScoredCandidate(
            symbol=c.symbol,
            engine=self.engine,
            direction=c.direction,
            score=score,
            classification=classify_score(score),
            breakdown=breakdown,
        )

    def scan(
        self, regime: MarketRegime, candidates: list[CoreCandidateInput]
    ) -> list[ScoredCandidate]:
        out = [self.evaluate(regime, c) for c in candidates]
        return [s for s in out if s is not None]


class TurboScanner:
    """Turbo Intraday — Long (Bull) or Short (Bear) (Master §13)."""

    engine = EngineType.TURBO

    def __init__(self) -> None:
        self._regime = MarketRegimeEngine()
        self._rvol = RVOLEngine()

    def evaluate(
        self, regime: MarketRegime, c: TurboCandidateInput
    ) -> Optional[ScoredCandidate]:
        # --- eligibility gates (fail -> drop) ---
        if not self._regime.allows(regime, c.direction):  # Long↔Bull / Short↔Bear
            return None
        if c.adv < C.ADV_MIN:
            return None
        if c.atr < C.ATR_MIN:
            return None
        if c.premarket_volume < C.PREMARKET_VOL_MIN:
            return None
        if not self._rvol.turbo_eligible(c.rvol):          # RVOL >= 3.0
            return None
        if c.gap_pct < C.GAP_MIN:                          # +4% gap
            return None
        # VWAP bias (mandatory): Long above VWAP, Short below VWAP
        if c.direction == Direction.LONG and not c.above_vwap:
            return None
        if c.direction == Direction.SHORT and c.above_vwap:
            return None

        # --- scoring (§8) ---
        gap_catalyst = (
            C.W_TURBO_GAP_CATALYST
            if c.catalyst
            else C.W_TURBO_GAP_CATALYST * C.BASE_AWARD_FRACTION
        )
        breakdown = {
            "rvol": self._rvol.turbo_points(c.rvol),
            "vwap_bias": C.W_TURBO_VWAP,
            "gap_catalyst": gap_catalyst,
            "orb": C.W_TURBO_ORB if c.orb_confirmed else Decimal("0"),
            "momentum": C.W_TURBO_MOMENTUM if c.momentum_ok else Decimal("0"),
        }
        score = sum(breakdown.values(), Decimal("0"))
        return ScoredCandidate(
            symbol=c.symbol,
            engine=self.engine,
            direction=c.direction,
            score=score,
            classification=classify_score(score),
            breakdown=breakdown,
        )

    def scan(
        self, regime: MarketRegime, candidates: list[TurboCandidateInput]
    ) -> list[ScoredCandidate]:
        out = [self.evaluate(regime, c) for c in candidates]
        return [s for s in out if s is not None]


__all__ = ["CoreScanner", "TurboScanner"]
