"""THUL-NURAYN v1 — D3 Market Regime Engine (Master §4, §12–13).

Classifies the market regime from SPY vs SMA200 (±1% band) and gates trade
direction: Long only in Bull, Short only in Bear, no new trades in Sideways.
Pure / deterministic — no state, no side effects.
"""

from __future__ import annotations

from src.enums import Direction, MarketRegime

from .constants import REGIME_BAND
from .facts import MarketFacts


class MarketRegimeEngine:
    def evaluate(self, facts: MarketFacts) -> MarketRegime:
        upper = facts.spy_sma_200 * (1 + REGIME_BAND)
        lower = facts.spy_sma_200 * (1 - REGIME_BAND)
        if facts.spy_price > upper:
            return MarketRegime.BULL
        if facts.spy_price < lower:
            return MarketRegime.BEAR
        return MarketRegime.SIDEWAYS

    def allows(self, regime: MarketRegime, direction: Direction) -> bool:
        """Direction gate: Long↔Bull, Short↔Bear, Sideways↔none."""
        if direction == Direction.LONG:
            return regime == MarketRegime.BULL
        if direction == Direction.SHORT:
            return regime == MarketRegime.BEAR
        return False


__all__ = ["MarketRegimeEngine"]
