"""THUL-NURAYN v1 — B9 recovery & rebuild flows.

Read-only reconstruction of transient in-memory state from PostgreSQL
(B9_INTEGRATION_ARCHITECTURE §5–§10). All flows:

  * read durable facts via the D2 DAL (`list`/`count`) — no writes to domain data,
  * replay them into freshly-constructed aggregates using ONLY existing D5/D6/B8
    public methods (so all invariants are honored by the owning phase),
  * surface inconsistencies as a B8 alert + DLQ entry and CONTINUE with the
    consistent subset (Owner Decision D5) — never repair/mutate domain rows.

Ratified recovery order (Owner Decision D4):
  Kill-Switch -> Portfolio -> Duplicate Protection -> Risk State -> Warm Redis.

B9 adds NO domain logic: no scoring, no risk decision, no execution, no sizing,
no portfolio formula. It only orchestrates existing components.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from src.enums import OrderStatus, PositionStatus, SeverityLevel, SystemEventType
from src.execution.duplicate import DuplicateOrderProtection
from src.portfolio import PnLCalculator, PortfolioState
from src.risk.state import KillSwitchLevel, RiskState

# America/New_York market session (Owner Decision D2).
_NY = ZoneInfo("America/New_York")

# In-flight order statuses whose fingerprints must remain blocked after restart.
_IN_FLIGHT = (OrderStatus.NEW, OrderStatus.SENT)


@dataclass
class RecoveryResult:
    """Outcome of a recovery run (transient; not persisted)."""

    kill_switch_level: int = 0
    open_positions: int = 0
    closed_positions: int = 0
    in_flight_orders: int = 0
    anomalies: list = field(default_factory=list)


# --------------------------------------------------------------------------- #
# §10 Kill-switch cache rebuild (FIRST per D4)
# --------------------------------------------------------------------------- #

def rebuild_kill_switch(kill_switch_cache) -> int:
    """Recover the current kill-switch level from system_events (B8).

    Delegates to the B8 cache; B9 never sets/decides the level.
    """
    return kill_switch_cache.rebuild()


# --------------------------------------------------------------------------- #
# §7 PortfolioState rebuild
# --------------------------------------------------------------------------- #

def rebuild_portfolio_state(
    dal,
    starting_capital: Decimal,
    *,
    dlq=None,
    alert_manager=None,
) -> tuple[PortfolioState, int, int, list]:
    """Replay persisted positions into a fresh PortfolioState (D6 public methods).

    Closed positions are replayed (open -> close) so cumulative realized PnL is
    reconstructed exactly; open positions are then re-opened. Returns the state
    plus (open_count, closed_count, anomalies).
    """
    state = PortfolioState(starting_capital)
    anomalies: list = []

    closed = dal.positions.list(status=PositionStatus.CLOSED)
    open_positions = dal.positions.list(status=PositionStatus.OPEN)

    # Deterministic replay order for closed positions.
    closed_sorted = sorted(
        closed,
        key=lambda p: (
            p.closed_at or datetime.min.replace(tzinfo=timezone.utc),
            p.opened_at,
        ),
    )
    for pos in closed_sorted:
        try:
            state.open_position(pos)
            state.close_position(pos)
        except Exception as exc:  # inconsistency -> alert + DLQ + continue (D5)
            _record_anomaly(
                anomalies, dlq, alert_manager,
                item_type="position:closed", entity_id=str(pos.id), reason=str(exc),
            )

    for pos in open_positions:
        try:
            state.open_position(pos)
        except Exception as exc:
            _record_anomaly(
                anomalies, dlq, alert_manager,
                item_type="position:open", entity_id=str(pos.id), reason=str(exc),
            )

    return state, state.open_count, state.closed_count, anomalies


# --------------------------------------------------------------------------- #
# §8 DuplicateOrderProtection rebuild
# --------------------------------------------------------------------------- #

def rebuild_duplicate_protection(
    dal,
    *,
    dlq=None,
    alert_manager=None,
) -> tuple[DuplicateOrderProtection, int, list]:
    """Re-register fingerprints of in-flight (New/Sent) orders (D5 public method)."""
    dop = DuplicateOrderProtection()
    anomalies: list = []
    count = 0
    for status in _IN_FLIGHT:
        for order in dal.orders.list(status=status):
            try:
                dop.register(order)
                count += 1
            except Exception as exc:
                _record_anomaly(
                    anomalies, dlq, alert_manager,
                    item_type="order:in_flight", entity_id=str(order.id),
                    reason=str(exc),
                )
    return dop, count, anomalies


# --------------------------------------------------------------------------- #
# §9 RiskState input builder (supplies D4 inputs; no rule change)
# --------------------------------------------------------------------------- #

class RiskStateBuilder:
    """Assembles the inputs D4 already expects — read-only. Decides nothing.

    D4 owns all thresholds/gates/decisions. B9 only supplies current counters,
    consistent with D4's contract that RiskState is passed in.
    """

    def __init__(self, dal, kill_switch_cache, *, clock=None) -> None:
        self._dal = dal
        self._ks = kill_switch_cache
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def _trades_today(self) -> int:
        """Orders created within the current America/New_York session day (D2)."""
        today_ny = self._clock().astimezone(_NY).date()
        count = 0
        for order in self._dal.orders.list():
            created = order.created_at
            if created is None:
                continue
            if created.astimezone(_NY).date() == today_ny:
                count += 1
        return count

    def _consecutive_losses(self) -> int:
        """Trailing consecutive losing closed trades (win = PnL > 0)."""
        closed = self._dal.positions.list(status=PositionStatus.CLOSED)
        closed_sorted = sorted(
            closed,
            key=lambda p: (
                p.closed_at or datetime.min.replace(tzinfo=timezone.utc),
                p.opened_at,
            ),
        )
        streak = 0
        for pos in reversed(closed_sorted):
            pnl = PnLCalculator.realized_for_position(pos)
            if pnl <= Decimal("0"):
                streak += 1
            else:
                break
        return streak

    def build(
        self,
        *,
        daily_drawdown: Decimal = Decimal("0"),
        weekly_drawdown: Decimal = Decimal("0"),
        monthly_pause_active: bool = False,
        candidate_sector_current_exposure: Decimal = Decimal("0"),
        candidate_sector_added_exposure: Decimal = Decimal("0"),
    ) -> RiskState:
        """Build a RiskState. Drawdowns/exposure are D6-computed figures passed in
        by the caller at decision time (D6 computes; D4 decides; B9 only relays).
        """
        level = int(self._ks.current_level())
        return RiskState(
            kill_switch_level=KillSwitchLevel(level),
            open_positions=self._dal.positions.count(status=PositionStatus.OPEN),
            trades_today=self._trades_today(),
            daily_drawdown=daily_drawdown,
            weekly_drawdown=weekly_drawdown,
            monthly_pause_active=monthly_pause_active,
            consecutive_losses=self._consecutive_losses(),
            candidate_sector_current_exposure=candidate_sector_current_exposure,
            candidate_sector_added_exposure=candidate_sector_added_exposure,
        )


# --------------------------------------------------------------------------- #
# §6 Redis cold-start warming (from PostgreSQL; non-fatal)
# --------------------------------------------------------------------------- #

def warm_redis_caches(kill_switch_cache, dlq, *, redis_client=None) -> None:
    """Warm Redis caches FROM PostgreSQL after rebuilds. Skipped if Redis down."""
    if redis_client is not None and not redis_client.available:
        return  # DEGRADED: reads fall back to PostgreSQL
    # kill-switch level cache is repopulated by rebuild(); refresh DLQ index.
    try:
        kill_switch_cache.rebuild()
    except Exception:
        pass
    try:
        dlq.rebuild_index()
    except Exception:
        pass


# --------------------------------------------------------------------------- #
# anomaly handling (D5: Alert + DLQ + Continue)
# --------------------------------------------------------------------------- #

def _record_anomaly(anomalies, dlq, alert_manager, *, item_type, entity_id, reason):
    record = {"item_type": item_type, "entity_id": entity_id, "reason": reason}
    anomalies.append(record)
    if alert_manager is not None:
        alert_manager.alert(
            SystemEventType.WORKER_FAILURE,
            SeverityLevel.CRITICAL,
            {"kind": "recovery_inconsistency", **record},
        )
    if dlq is not None:
        dlq.dead_letter(
            item_type=f"recovery:{item_type}",
            payload={"entity_id": entity_id},
            reason=reason,
            correlation={"entity_id": entity_id},
        )


__all__ = [
    "RecoveryResult",
    "RiskStateBuilder",
    "rebuild_kill_switch",
    "rebuild_portfolio_state",
    "rebuild_duplicate_protection",
    "warm_redis_caches",
]
