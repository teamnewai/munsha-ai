"""Strategy 2 (PROPOSED) — independent strategy configuration.

Self-contained: defines this strategy's quality threshold and exit configuration.
Independent of Strategy 1's defaults; editing these never affects the baseline.
"""

from __future__ import annotations

from decimal import Decimal

from src.selection import constants as _SC

from ..exit_decision import ExitConfig

STRATEGY_NAME = "proposed"

# Quality gate: execute only signals scoring at/above the Golden band (>= 95).
# (Strategy 1 trades every eligible candidate regardless of band — F-A.)
MIN_SCORE: Decimal = _SC.GOLDEN_MIN  # Decimal("95")


def proposed_exit_config() -> ExitConfig:
    """PROVISIONAL 'sound approach' exit configuration (independent of baseline).

    Tighter protective stops (smaller losses), earlier break-even with a clearly
    positive offset (a defended trade books a small win, not a scratch-loss under
    the frozen win=PnL>0 convention), and a wider trail (winners run further).
    Values are illustrative placeholders — finals come from the Master Spec /
    owner; the engine treats them as injected configuration only.
    """
    return ExitConfig(
        core_hard_stop_pct=Decimal("0.06"),            # tighter than baseline 0.08
        turbo_hard_stop_pct=Decimal("0.015"),          # tighter than baseline 0.02
        turbo_breakeven_trigger_pct=Decimal("0.01"),   # arm earlier than 0.015
        turbo_breakeven_offset_pct=Decimal("0.003"),   # clearly positive (>0.0025)
        turbo_trailing_pct=Decimal("0.03"),            # wider than baseline 0.02
        turbo_session_close_cutoff_min=10,
    )


__all__ = ["STRATEGY_NAME", "MIN_SCORE", "proposed_exit_config"]
