"""Strategy 2 (PROPOSED) — independent strategy configuration.

Self-contained: this strategy's quality threshold and exit configuration.
Independent of Strategy 1; editing these never affects the baseline.
"""

from __future__ import annotations

from decimal import Decimal

from src.selection import constants as _SC

from .exit_engine import Strategy2ExitConfig

STRATEGY_NAME = "proposed"

# Quality gate: execute only signals scoring at/above the Golden band (>= 95).
MIN_SCORE: Decimal = _SC.GOLDEN_MIN  # Decimal("95")


def proposed_exit_config() -> Strategy2ExitConfig:
    """PROVISIONAL 'sound approach' exit config (independent of baseline).

    Core now has a full active profit exit (hard + break-even + trailing) plus a
    regime-flip thesis exit. Tighter stops (smaller losses), positive break-even
    offsets (scratch -> small win), wider trails (winners run / PF-first). Values
    are illustrative placeholders; finals come from the Master Spec / owner.
    """
    return Strategy2ExitConfig(
        core_hard_stop_pct=Decimal("0.06"),     # tighter than Strategy 1's 0.08
        core_be_trigger_pct=Decimal("0.03"),    # arm break-even after +3%
        core_be_offset_pct=Decimal("0.005"),    # lock +0.5% (positive offset)
        core_trailing_pct=Decimal("0.04"),      # 4% trail — let winners run
        turbo_hard_stop_pct=Decimal("0.015"),   # tighter than baseline 0.02
        turbo_be_trigger_pct=Decimal("0.01"),   # arm earlier than 0.015
        turbo_be_offset_pct=Decimal("0.003"),   # clearly positive
        turbo_trailing_pct=Decimal("0.03"),     # wider than baseline 0.02
        turbo_session_close_cutoff_min=10,
    )


__all__ = ["STRATEGY_NAME", "MIN_SCORE", "proposed_exit_config"]
