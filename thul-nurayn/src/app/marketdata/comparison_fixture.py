"""THUL-NURAYN — strategy-neutral A/B comparison fixture (deterministic).

A single fixture run IDENTICALLY by Strategy 1 and Strategy 2. It is the OR-2
Turbo campaign (the established baseline, `build_campaign()`) with Core episodes
appended so the Core engine — and therefore the Strategy 2 Core profit exit
(F-B) — is actually exercised. Strategy 1's Turbo portion reproduces the
official baseline exactly; the Core portion is where the strategies diverge.

Core episodes (Long, Bull) use forward mark paths (Core has no session flatten):
  * WINNER path: open → +12% peak → +7% retrace → −8% (back to S1's hard stop).
      - Strategy 2: trailing stop books the +7% (winner).
      - Strategy 1: no profit exit → rides up then down to its hard stop (−8%).
  * LOSS path: open → −9% straight down.
      - Both strategies close at the hard stop (equal loss).

Turbo trades are identical for both (session-flatten at fixed marks; all
UltraGolden so the quality gate keeps them). The measured difference is the Core
trend-capture that Strategy 1 structurally cannot realize.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from .campaign_fixture import UNIVERSE, _BASE, N_DAYS, build_campaign

# Core episode mark multipliers (applied to each symbol's entry).
_WIN_PATH = (Decimal("1.12"), Decimal("1.07"), Decimal("0.92"))  # peak, retrace, hard-stop
_LOSS_PATH = (Decimal("0.91"),)                                    # straight to hard stop
_N_WIN_EPISODES = 5
_N_LOSS_EPISODES = 3
_BULL_FACTS = {"spy_price": "520", "spy_sma_200": "470", "adx": "25"}


def _core_candidate(symbol: str) -> dict:
    """A strong Core-Swing Long candidate (UltraGolden, Bull)."""
    return {
        "symbol": symbol, "direction": "Long",
        "rs_rating": "95", "rvol": "2.5", "adv": 1_000_000, "trend_stage2": True,
        "breakout": {"new_52w_high": True, "base_breakout": True, "base_days": 60},
        "earnings": {"surprise_positive": True, "days_since": 3, "aligned": True},
    }


def _core_episode(start_day_offset: int, multipliers: tuple) -> list:
    """One Core episode: an open frame + one forward frame per multiplier."""
    frames: list = []
    open_day = _BASE + timedelta(days=start_day_offset)
    # OPEN frame — 5 Core Long candidates at entry marks.
    frames.append({
        "captured_at": open_day.replace(hour=14, minute=30).isoformat(),
        "market_open": True,
        "market_facts": dict(_BULL_FACTS),
        "core": [_core_candidate(sym) for (sym, _s, _e) in UNIVERSE],
        "turbo": [],
        "marks": {sym: str(entry) for (sym, _s, entry) in UNIVERSE},
    })
    # FORWARD frames — no candidates; marks trace the path; exits evaluate.
    for i, mult in enumerate(multipliers):
        day = _BASE + timedelta(days=start_day_offset + 1 + i)
        frames.append({
            "captured_at": day.replace(hour=14, minute=30).isoformat(),
            "market_open": True,
            "market_facts": dict(_BULL_FACTS),
            "core": [],
            "turbo": [],
            "marks": {sym: str((entry * mult).quantize(Decimal("0.01")))
                      for (sym, _s, entry) in UNIVERSE},
        })
    return frames


def build_comparison() -> list:
    """Turbo baseline (OR-2) + appended Core episodes. Deterministic, shared."""
    specs = build_campaign()                 # 45 Turbo days (the official baseline)
    day = N_DAYS + 2                          # start Core after the Turbo phase
    for e in range(_N_WIN_EPISODES + _N_LOSS_EPISODES):
        path = _WIN_PATH if e < _N_WIN_EPISODES else _LOSS_PATH
        specs.extend(_core_episode(day, path))
        day += len(path) + 2                  # gap so each episode fully closes first
    return specs


__all__ = ["build_comparison"]
