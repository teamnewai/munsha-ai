"""THUL-NURAYN v1 — D14 validation metrics (read-only).

Read-only performance measurement over persisted paper data
(D14_PAPER_VALIDATION_ARCHITECTURE.md §4). Reuses the D6 calculators
(`PnLCalculator`, `EquityTracker`) — no formula is reimplemented and nothing is
written by this module. Produces a transient `ValidationReport`.

NOT in scope (excluded by owner): recommendation engine, auto-tuning (D14A).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from src.enums import Direction, PositionStatus, SystemEventType
from src.models import Position
from src.portfolio import EquityTracker, PnLCalculator

_NY = ZoneInfo("America/New_York")


@dataclass(frozen=True)
class Breakdown:
    """Per-group performance slice (transient)."""

    key: str
    trades: int
    wins: int
    win_rate: Decimal
    net_pnl: Decimal
    profit_factor: Optional[Decimal]  # None when no losses


@dataclass(frozen=True)
class ValidationReport:
    """Read-only validation measurement snapshot (transient; not persisted)."""

    captured_at: datetime
    starting_capital: Decimal
    ending_equity: Decimal
    # headline
    span_days: int
    active_trading_days: int
    trades: int
    wins: int
    losses: int
    win_rate: Decimal
    gross_profit: Decimal
    gross_loss: Decimal
    profit_factor: Optional[Decimal]
    avg_r_multiple_proxy: Optional[Decimal]
    max_drawdown: Decimal
    worst_drawdown: Decimal
    recovered: bool
    portfolio_return: Decimal
    max_consecutive_wins: int
    max_consecutive_losses: int
    # coverage
    regimes_observed: tuple
    long_tested: bool
    short_tested: bool
    # breakdowns
    by_sector: tuple = field(default_factory=tuple)
    by_direction: tuple = field(default_factory=tuple)
    by_score_band: tuple = field(default_factory=tuple)
    by_regime: tuple = field(default_factory=tuple)
    data_quality: dict = field(default_factory=dict)


def _closed_sorted(dal) -> list:
    closed = dal.positions.list(status=PositionStatus.CLOSED)
    return sorted(
        closed,
        key=lambda p: (
            p.closed_at or datetime.min.replace(tzinfo=timezone.utc),
            p.opened_at,
        ),
    )


def _profit_factor(positions: list) -> tuple[Decimal, Decimal, Optional[Decimal]]:
    gross_profit = Decimal("0")
    gross_loss = Decimal("0")
    for p in positions:
        pnl = PnLCalculator.realized_for_position(p)
        if pnl > Decimal("0"):
            gross_profit += pnl
        elif pnl < Decimal("0"):
            gross_loss += -pnl
    pf = (gross_profit / gross_loss) if gross_loss > Decimal("0") else None
    return gross_profit, gross_loss, pf


def _avg_r_multiple_proxy(positions: list) -> Optional[Decimal]:
    """Proxy R (OD-D14-1): per-trade PnL ÷ average absolute losing-trade PnL.

    Labeled a proxy — v1 persists no per-trade risk basis. None if no losses.
    """
    losers = [
        -PnLCalculator.realized_for_position(p)
        for p in positions
        if PnLCalculator.realized_for_position(p) < Decimal("0")
    ]
    if not losers:
        return None
    avg_abs_loss = sum(losers, Decimal("0")) / Decimal(len(losers))
    if avg_abs_loss == Decimal("0"):
        return None
    rs = [PnLCalculator.realized_for_position(p) / avg_abs_loss for p in positions]
    return sum(rs, Decimal("0")) / Decimal(len(rs))


def _drawdown_and_recovery(
    positions: list, starting_capital: Decimal
) -> tuple[Decimal, Decimal, bool, Decimal]:
    """Return (max_drawdown, worst_drawdown, recovered, ending_equity).

    Equity curve = starting_capital + cumulative realized PnL (D6 cash convention;
    realized only — open/unrealized excluded, fail-safe). Drawdown via D6 EquityTracker.
    """
    tracker = EquityTracker(starting_capital)
    running = starting_capital
    worst = Decimal("0")
    for p in positions:
        running += PnLCalculator.realized_for_position(p)
        tracker.update(running)
        worst = min(worst, tracker.drawdown(running))
    ending_equity = running
    recovered = tracker.drawdown(ending_equity) == Decimal("0")
    return worst, worst, recovered, ending_equity


def _streaks(positions: list) -> tuple[int, int]:
    max_w = max_l = cur_w = cur_l = 0
    for p in positions:
        if PnLCalculator.realized_for_position(p) > Decimal("0"):
            cur_w += 1
            cur_l = 0
        else:
            cur_l += 1
            cur_w = 0
        max_w = max(max_w, cur_w)
        max_l = max(max_l, cur_l)
    return max_w, max_l


def _slice(positions: list, key: str) -> Breakdown:
    wins = sum(1 for p in positions if PnLCalculator.realized_for_position(p) > 0)
    net = PnLCalculator.realized(positions)
    _, _, pf = _profit_factor(positions)
    n = len(positions)
    wr = (Decimal(wins) / Decimal(n)) if n else Decimal("0")
    return Breakdown(key=key, trades=n, wins=wins, win_rate=wr, net_pnl=net,
                     profit_factor=pf)


def _group_by(positions: list, key_fn) -> tuple:
    groups: dict = {}
    for p in positions:
        k = key_fn(p)
        groups.setdefault(k, []).append(p)
    return tuple(_slice(v, str(k)) for k, v in sorted(groups.items(), key=lambda kv: str(kv[0])))


def _regimes_observed(dal) -> tuple:
    """Distinct regimes seen during the campaign, from scan audit events."""
    seen = set()
    for ev in dal.system_events.list(event_type=SystemEventType.GATEWAY_EVENT):
        d = ev.detail or {}
        if d.get("kind") in ("scan", "cycle_summary") and d.get("regime"):
            seen.add(d["regime"])
    return tuple(sorted(seen))


def compute_validation_metrics(
    dal,
    starting_capital: Decimal,
    *,
    now: Optional[datetime] = None,
) -> ValidationReport:
    """Compute the full read-only validation report from persisted paper data."""
    now = now or datetime.now(timezone.utc)
    closed = _closed_sorted(dal)

    wins = sum(1 for p in closed if PnLCalculator.realized_for_position(p) > 0)
    losses = len(closed) - wins
    trades = len(closed)
    win_rate = (Decimal(wins) / Decimal(trades)) if trades else Decimal("0")
    gross_profit, gross_loss, pf = _profit_factor(closed)
    max_dd, worst_dd, recovered, ending_equity = _drawdown_and_recovery(
        closed, starting_capital)
    max_w, max_l = _streaks(closed)
    portfolio_return = (
        (ending_equity - starting_capital) / starting_capital
        if starting_capital > 0 else Decimal("0")
    )

    # spans (NY trading days)
    def _ny_date(dt):
        return dt.astimezone(_NY).date() if dt else None
    active_days = len({_ny_date(p.closed_at) for p in closed if p.closed_at})
    if closed:
        first = min((p.opened_at for p in closed), default=now)
        last = max((p.closed_at or now for p in closed), default=now)
        span_days = max(0, (last.astimezone(_NY).date() - first.astimezone(_NY).date()).days)
    else:
        span_days = 0

    # breakdowns
    by_direction = _group_by(closed, lambda p: p.direction.value)
    by_sector = _group_by(closed, lambda p: _lookup_sector(dal, p.instrument_id))
    by_score_band = _group_by(closed, lambda p: _lookup_band(dal, p))
    long_tested = any(p.direction is Direction.LONG for p in closed)
    short_tested = any(p.direction is Direction.SHORT for p in closed)
    regimes = _regimes_observed(dal)

    data_quality = {
        "regime_per_trade_attributed": False,  # not persisted by current orchestration
        "regimes_observed_source": "scan_audit_events",
        "r_multiple": "proxy (no per-trade risk basis; OD-D14-1)",
        "equity_curve": "realized PnL only (open/unrealized excluded, fail-safe)",
    }

    return ValidationReport(
        captured_at=now, starting_capital=starting_capital,
        ending_equity=ending_equity, span_days=span_days,
        active_trading_days=active_days, trades=trades, wins=wins, losses=losses,
        win_rate=win_rate, gross_profit=gross_profit, gross_loss=gross_loss,
        profit_factor=pf, avg_r_multiple_proxy=_avg_r_multiple_proxy(closed),
        max_drawdown=max_dd, worst_drawdown=worst_dd, recovered=recovered,
        portfolio_return=portfolio_return, max_consecutive_wins=max_w,
        max_consecutive_losses=max_l, regimes_observed=regimes,
        long_tested=long_tested, short_tested=short_tested,
        by_sector=by_sector, by_direction=by_direction,
        by_score_band=by_score_band, by_regime=tuple(), data_quality=data_quality,
    )


def _lookup_sector(dal, instrument_id) -> str:
    instr = dal.instruments.get_or_none(instrument_id)
    return str(instr.sector_id) if instr is not None else "unknown"


def _lookup_band(dal, position: Position) -> str:
    orders = dal.orders_for_position(position.id)
    for o in orders:
        if o.signal_id is not None:
            score = dal.score_for_signal(o.signal_id)
            if score is not None:
                return score.classification.value
    return "unknown"


__all__ = [
    "ValidationReport",
    "Breakdown",
    "compute_validation_metrics",
]
