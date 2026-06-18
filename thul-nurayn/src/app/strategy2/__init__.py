"""THUL-NURAYN — Strategy 2 (PROPOSED), an INDEPENDENT replica of the pipeline.

Self-contained second strategy. Does NOT modify and is NOT merged with Strategy 1
(the baseline `src/app/orchestrator.py`, which stays exactly as built). Reuses
only the FROZEN shared foundation (D1–D6 domain, engines, DAL, sizing, targets,
exit machinery) and carries its own independent strategy logic.

Independent modifications vs Strategy 1 (the "sound approach"):
  1. Quality gate — execute only high-band signals (score ≥ Golden).
  2. Active Core profit exit (resolves F-B): hard stop + positive break-even +
     trailing + regime-flip thesis exit (Strategy2ExitEngine).
  3. Sound-approach exit config (tighter stops, positive offsets, wider trails).
"""

from .config import MIN_SCORE, STRATEGY_NAME, proposed_exit_config
from .exit_engine import Strategy2ExitConfig, Strategy2ExitEngine
from .orchestrator import Strategy2Orchestrator

__all__ = [
    "Strategy2Orchestrator",
    "Strategy2ExitEngine",
    "Strategy2ExitConfig",
    "proposed_exit_config",
    "MIN_SCORE",
    "STRATEGY_NAME",
]
