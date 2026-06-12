"""THUL-NURAYN v1 — D3 Selection constants.

Single source for all selection thresholds and weights, transcribed verbatim
from the Master Specification (§3 Scanner, §4 Regime, §8 Score, §9–11
Classification, §12–13 Long/Short). No values invented for thresholds.

D3 applies these thresholds to passed-in facts; it does NOT compute indicators
or prices from raw market data (D3_SELECTION_REPORT §4, §8).
"""

from __future__ import annotations

from decimal import Decimal

# --- Market regime (Master §4) ------------------------------------------------
REGIME_BAND = Decimal("0.01")  # ±1% band around SPY SMA200

# --- Relative strength (Master §3, §12) --------------------------------------
RS_MIN = Decimal("80")    # eligibility gate
RS_BOOST = Decimal("90")  # full-award level

# --- RVOL (Master §3) --------------------------------------------------------
RVOL_CORE_MIN = Decimal("1.5")    # Core confirmation gate
RVOL_CORE_BOOST = Decimal("2.0")  # Core full-award level
RVOL_TURBO_MIN = Decimal("3.0")   # Turbo gate

# --- Turbo universe / structure (Master §2, §3, §13) -------------------------
GAP_MIN = Decimal("0.04")          # +4% gap
ATR_MIN = Decimal("0.5")           # $0.50
ADV_MIN = 500_000                  # average daily volume
PREMARKET_VOL_MIN = 100_000        # premarket volume (Turbo)

# --- Breakout (Master §3, §12) -----------------------------------------------
BASE_HIGH_MIN_DAYS = 50  # a "base high" qualifies at >= 50 days

# --- PEAD (Master §3, §7) ----------------------------------------------------
PEAD_MAX_DAYS = 10  # earnings surprise within <= 10 days (complementary)

# --- Score weights (Master §8) -----------------------------------------------
# Core Swing /100
W_CORE_REGIME = Decimal("20")
W_CORE_RS = Decimal("20")
W_CORE_BREAKOUT = Decimal("20")
W_CORE_RVOL = Decimal("15")
W_CORE_TREND = Decimal("15")
W_CORE_PEAD = Decimal("10")

# Turbo Intraday /100
W_TURBO_RVOL = Decimal("25")
W_TURBO_VWAP = Decimal("20")
W_TURBO_GAP_CATALYST = Decimal("20")
W_TURBO_ORB = Decimal("20")
W_TURBO_MOMENTUM = Decimal("15")

# --- Classification bands (Master §9–11) -------------------------------------
SCORE_MAX = Decimal("100")
GOLDEN_MIN = Decimal("95")     # Golden 95–99
STRONG_MIN = Decimal("90")     # Strong 90–94
# UltraGolden == 100 ; Watchlist < 90

# --- Scoring-curve assumption (documented in B3_BUILD_REPORT) ----------------
# The Master Spec gives thresholds and weights but not an intra-component
# grading curve. Two-tier components award the full weight at the boost level
# and BASE_AWARD_FRACTION of the weight at the minimum (eligibility) threshold.
BASE_AWARD_FRACTION = Decimal("0.7")

__all__ = [n for n in dir() if n.isupper()]
