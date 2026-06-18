"""THUL-NURAYN v1 — OR-2 deterministic paper-validation campaign fixture.

A network-free, fully deterministic replay dataset (no RNG) that drives the
composed app to produce the closed-trade population the D14 validation campaign
requires. Pairs with the EX-2..EX-4 exit leg: each trading day is an OPEN frame
(market_open=True, 5 Turbo candidates) followed by a CLOSE frame
(market_open=False) whose marks deterministically set each position's exit price
via the mandatory session-close flatten — so every opened position closes the
same day at a controlled price.

Design (keeps every D4 gate from ever blocking entries, so the run is stable):
  * 5 symbols, ONE per sector  -> SectorExposure never concentrates (>25%).
  * per-day outcome pattern [W,L,L,W,W] -> at most 2 consecutive losses, every
    day ends on wins, so the ConsecutiveLoss gate (limit 3) never trips and the
    trailing streak resets each day.
  * a mid-campaign drawdown stretch then recovery -> non-trivial max-drawdown and
    a `recovered` equity curve, while the trailing-7-day realized drawdown stays
    shallow (< 6%) so the WeeklyDrawdown gate never blocks.
  * Bull days trade Long, Bear days trade Short (alternating) -> both regimes and
    both directions are exercised.

Coverage produced: 45 trading days (>=30), 225 closed trades (>=200), Bull+Bear,
Long+Short, every traded symbol seeded, all D14 metrics computable.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from src.enums import Market
from src.models import Instrument, Sector

_UTC = timezone.utc
_BASE = datetime(2026, 1, 5, tzinfo=_UTC)   # campaign start (Mon)
STARTING_CAPITAL = Decimal("100000")
ALLOCATION_FRACTION = Decimal("0.10")

# (symbol, sector_name, entry_price) — one symbol per sector (no concentration).
UNIVERSE: tuple = (
    ("NVDA", "Semiconductors", Decimal("100")),
    ("AAPL", "Hardware", Decimal("110")),
    ("MSFT", "Software", Decimal("120")),
    ("AMZN", "ConsumerDisc", Decimal("130")),
    ("TSLA", "AutoEV", Decimal("140")),
)

N_DAYS = 45
# Signed per-slot gains (fraction of entry). Pattern [W,L,L,W,W]: <=2 consecutive
# losses, day ends on wins. Up days net positive; down days net negative.
_UP_G = (Decimal("0.03"), Decimal("-0.02"), Decimal("-0.02"), Decimal("0.03"), Decimal("0.03"))
_DOWN_G = (Decimal("0.01"), Decimal("-0.04"), Decimal("-0.04"), Decimal("0.01"), Decimal("0.01"))
_DOWN_DAYS = frozenset(range(20, 27))   # drawdown stretch; recovery afterwards


def _turbo(symbol: str, direction: str) -> dict:
    """A strong Turbo candidate (passes D3 eligibility + D4 gates)."""
    return {
        "symbol": symbol, "direction": direction,
        "rvol": "3.5", "adv": 1_000_000, "atr": "1.20",
        "premarket_volume": 200_000, "gap_pct": "0.05",
        "above_vwap": direction == "Long",   # Long above VWAP / Short below
        "catalyst": True, "orb_confirmed": True, "momentum_ok": True,
    }


def _facts(bull: bool) -> dict:
    # Bull: 520 > 470*1.01 ; Bear: 440 < 470*0.99
    return {"spy_price": "520" if bull else "440", "spy_sma_200": "470", "adx": "25"}


def _exit_mark(entry: Decimal, direction: str, g: Decimal) -> str:
    one = Decimal("1")
    px = entry * (one + g) if direction == "Long" else entry * (one - g)
    return str(px.quantize(Decimal("0.01")))


def build_campaign() -> list:
    """Return the deterministic ordered list of replay frame-specs (90 frames)."""
    specs: list = []
    for d in range(N_DAYS):
        bull = (d % 2 == 0)
        direction = "Long" if bull else "Short"
        gains = _DOWN_G if d in _DOWN_DAYS else _UP_G
        day = _BASE + timedelta(days=d)
        # OPEN frame — 5 candidates, entry marks.
        specs.append({
            "captured_at": day.replace(hour=14, minute=30).isoformat(),
            "market_open": True,
            "market_facts": _facts(bull),
            "core": [],
            "turbo": [_turbo(sym, direction) for (sym, _s, _e) in UNIVERSE],
            "marks": {sym: str(entry) for (sym, _s, entry) in UNIVERSE},
        })
        # CLOSE frame — session flatten at controlled exit marks.
        specs.append({
            "captured_at": day.replace(hour=21, minute=0).isoformat(),
            "market_open": False,
            "market_facts": _facts(bull),
            "core": [],
            "turbo": [],
            "marks": {sym: _exit_mark(entry, direction, gains[i])
                      for i, (sym, _s, entry) in enumerate(UNIVERSE)},
        })
    return specs


def seed_universe(dal) -> list:
    """Seed a Sector + Instrument for every traded symbol. Returns the instruments."""
    instruments: list = []
    for (sym, sector_name, _entry) in UNIVERSE:
        sec = Sector(id=uuid4(), name=sector_name, created_at=_BASE)
        dal.sectors.add(sec)
        inst = Instrument(id=uuid4(), symbol=sym, market=Market.NASDAQ,
                          sector_id=sec.id, created_at=_BASE)
        dal.instruments.add(inst)
        instruments.append(inst)
    return instruments


__all__ = [
    "build_campaign",
    "seed_universe",
    "UNIVERSE",
    "N_DAYS",
    "STARTING_CAPITAL",
    "ALLOCATION_FRACTION",
]
