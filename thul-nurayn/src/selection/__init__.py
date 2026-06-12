"""THUL-NURAYN v1 — D3 Selection Engine.

Deterministic candidate selection: market regime, Core/Turbo scanners, the
RS/Breakout/RVOL/PEAD components, ranking, and classification (Master §3,§4,
§8–13). Pure functions over passed-in facts — no risk, sizing, portfolio,
execution, or broker logic; no I/O; no D2 access; 100% offline.
"""

from __future__ import annotations

from .components import (
    BreakoutDetectionEngine,
    PEADIntegrationLayer,
    RVOLEngine,
    RelativeStrengthEngine,
)
from .engine import SelectionEngine, SelectionResult
from .facts import (
    BreakoutFacts,
    CoreCandidateInput,
    EarningsFacts,
    MarketFacts,
    ScoredCandidate,
    TurboCandidateInput,
)
from .ranking import RankingEngine, TradeClassificationEngine, classify_score
from .regime import MarketRegimeEngine
from .scanners import CoreScanner, TurboScanner

__all__ = [
    # engine / orchestrator
    "SelectionEngine",
    "SelectionResult",
    # regime / scanners
    "MarketRegimeEngine",
    "CoreScanner",
    "TurboScanner",
    # components
    "RelativeStrengthEngine",
    "BreakoutDetectionEngine",
    "RVOLEngine",
    "PEADIntegrationLayer",
    # ranking / classification
    "RankingEngine",
    "TradeClassificationEngine",
    "classify_score",
    # facts / value objects
    "MarketFacts",
    "BreakoutFacts",
    "EarningsFacts",
    "CoreCandidateInput",
    "TurboCandidateInput",
    "ScoredCandidate",
]
