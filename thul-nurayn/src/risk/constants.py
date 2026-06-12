"""THUL-NURAYN v1 — D4 Risk Gate limits (Master §14, §17–19).

All limits transcribed verbatim from the Master Specification. No values
invented. (Capital 70/30 is a portfolio/sizing rule, NOT a per-trade gate —
out of D4 scope.)
"""

from __future__ import annotations

from decimal import Decimal

MAX_OPEN_POSITIONS = 5                      # open < 5
MAX_TRADES_PER_DAY = 5                      # trades_today < 5
DAILY_DRAWDOWN_LIMIT = Decimal("-0.03")     # daily > -3%
WEEKLY_DRAWDOWN_LIMIT = Decimal("-0.06")    # weekly > -6%
CONSECUTIVE_LOSS_LIMIT = 3                   # consecutive < 3
SECTOR_EXPOSURE_MAX = Decimal("0.25")       # (current + added) <= 25%

# Kill Switch: new trades are blocked at L2 and above (Master §19).
KILL_SWITCH_BLOCK_LEVEL = 2

__all__ = [
    "MAX_OPEN_POSITIONS",
    "MAX_TRADES_PER_DAY",
    "DAILY_DRAWDOWN_LIMIT",
    "WEEKLY_DRAWDOWN_LIMIT",
    "CONSECUTIVE_LOSS_LIMIT",
    "SECTOR_EXPOSURE_MAX",
    "KILL_SWITCH_BLOCK_LEVEL",
]
