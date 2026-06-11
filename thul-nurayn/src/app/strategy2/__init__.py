"""THUL-NURAYN — Strategy 2 (PROPOSED), an INDEPENDENT replica of the pipeline.

This package is a self-contained second strategy. It does NOT modify and is NOT
merged with Strategy 1 (the baseline `src/app/orchestrator.py`, which stays
exactly as built). It reuses only the FROZEN shared foundation (D1–D6 domain,
the engines, DAL, sizing, targets, exit machinery) — that foundation is the
immutable base, not "the strategy" — and carries its own independent strategy
logic so changes here never affect Strategy 1 and vice-versa.

Independent modifications vs Strategy 1 (the "sound approach"):
  1. Quality gate — execute only high-band signals (score ≥ Golden), instead of
     trading every eligible candidate regardless of classification.
  2. Sound-approach exit config — tighter protective stop (smaller losses),
     earlier break-even with a clearly positive offset (scratch → small win),
     wider trailing (let winners run). Provisional/illustrative values; finals
     come from the Master Spec / owner.
"""

from .config import MIN_SCORE, STRATEGY_NAME, proposed_exit_config
from .orchestrator import Strategy2Orchestrator

__all__ = [
    "Strategy2Orchestrator",
    "proposed_exit_config",
    "MIN_SCORE",
    "STRATEGY_NAME",
]
