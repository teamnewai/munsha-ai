"""THUL-NURAYN v1 — D3 Selection Engine orchestrator.

Wires the pipeline (D3_SELECTION_REPORT §3):
    MarketFacts -> MarketRegimeEngine -> (regime + direction gate)
    Candidate   -> Core/Turbo Scanner -> ScoredCandidate (/100 + breakdown)
                -> RankingEngine (desc) -> classification

Core and Turbo are independent (engine tag). Pure / deterministic; no state,
no I/O, no D2 access, no risk/execution logic.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.enums import MarketRegime

from .facts import CoreCandidateInput, MarketFacts, ScoredCandidate, TurboCandidateInput
from .ranking import RankingEngine
from .regime import MarketRegimeEngine
from .scanners import CoreScanner, TurboScanner


@dataclass(frozen=True)
class SelectionResult:
    regime: MarketRegime
    core: list[ScoredCandidate]
    turbo: list[ScoredCandidate]


class SelectionEngine:
    def __init__(self) -> None:
        self.regime_engine = MarketRegimeEngine()
        self.core_scanner = CoreScanner()
        self.turbo_scanner = TurboScanner()
        self.ranking = RankingEngine()

    def run_core(
        self, market: MarketFacts, candidates: list[CoreCandidateInput]
    ) -> list[ScoredCandidate]:
        regime = self.regime_engine.evaluate(market)
        return self.ranking.rank(self.core_scanner.scan(regime, candidates))

    def run_turbo(
        self, market: MarketFacts, candidates: list[TurboCandidateInput]
    ) -> list[ScoredCandidate]:
        regime = self.regime_engine.evaluate(market)
        return self.ranking.rank(self.turbo_scanner.scan(regime, candidates))

    def run(
        self,
        market: MarketFacts,
        core_candidates: list[CoreCandidateInput] | None = None,
        turbo_candidates: list[TurboCandidateInput] | None = None,
    ) -> SelectionResult:
        regime = self.regime_engine.evaluate(market)
        core = self.ranking.rank(
            self.core_scanner.scan(regime, core_candidates or [])
        )
        turbo = self.ranking.rank(
            self.turbo_scanner.scan(regime, turbo_candidates or [])
        )
        return SelectionResult(regime=regime, core=core, turbo=turbo)


__all__ = ["SelectionEngine", "SelectionResult"]
