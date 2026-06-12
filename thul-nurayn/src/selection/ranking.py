"""THUL-NURAYN v1 — D3 Ranking & Classification (Master §8–11).

RankingEngine: descending by score, deterministic tie-break by symbol (asc).
TradeClassificationEngine: maps a /100 score to its band.
Pure / deterministic.
"""

from __future__ import annotations

from decimal import Decimal

from src.enums import TradeClassification

from . import constants as C
from .facts import ScoredCandidate


def classify_score(score: Decimal) -> TradeClassification:
    if score >= C.SCORE_MAX:
        return TradeClassification.ULTRA_GOLDEN
    if score >= C.GOLDEN_MIN:
        return TradeClassification.GOLDEN
    if score >= C.STRONG_MIN:
        return TradeClassification.STRONG
    return TradeClassification.WATCHLIST


class TradeClassificationEngine:
    def classify(self, score: Decimal) -> TradeClassification:
        return classify_score(score)


class RankingEngine:
    def rank(self, candidates: list[ScoredCandidate]) -> list[ScoredCandidate]:
        """Descending by score; ties broken by symbol ascending (stable)."""
        return sorted(candidates, key=lambda c: (-c.score, c.symbol))


__all__ = ["classify_score", "TradeClassificationEngine", "RankingEngine"]
