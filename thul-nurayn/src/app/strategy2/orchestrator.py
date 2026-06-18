"""Strategy 2 (PROPOSED) — independent orchestrator (replica of P-ORCH + mods).

A standalone copy of the autonomous conductor so Strategy 2 evolves independently
of Strategy 1. It sequences the SAME shared, frozen components (Selection D3 →
Risk D4 → Sizing P-SIZE → Execution target/D5 → Portfolio D6 → exit leg) but adds
this strategy's two independent modifications:

  * QUALITY GATE — after scoring, keep only candidates scoring ≥ `min_score`
    (Golden+), so only high-band signals are traded.
  * Its own EXIT CONFIG — the sound-approach `proposed_exit_config()` (tighter
    stops, earlier break-even with a positive offset, wider trailing).

Everything else mirrors the baseline (kill-switch first, exits permitted L1–L3,
data-quality reject, full D4 input set, durable audit). No baseline file is
imported for its *logic* — only the neutral result DTO and state labels are
shared; the orchestration logic here is independent.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from src.enums import MarketRegime, PositionStatus, SeverityLevel, SystemEventType
from src.execution.errors import ExecutionError
from src.models import RiskCheck, Score, Signal
from src.operations.events import emit_system_event
from src.portfolio import PnLCalculator
from src.selection.regime import MarketRegimeEngine

from ..exit_decision import (
    ExitEvaluationContext,
    ExitState,
)
from .exit_engine import Strategy2ExitEngine
from ..orchestrator import (  # neutral shared DTO + state labels (not strategy logic)
    COMPLETED,
    HALTED,
    PAUSED_SCANNER,
    REJECTED,
    CycleResult,
)
from ..sizing import CapitalSettings, SizingPolicy
from ..targets.base import ExecutionIntent
from .config import MIN_SCORE, STRATEGY_NAME, proposed_exit_config

_L1, _L4 = 1, 4
_NY = ZoneInfo("America/New_York")
_MIN_DT = datetime.min.replace(tzinfo=timezone.utc)


def _ks_severity(level: int) -> SeverityLevel:
    if level >= _L4:
        return SeverityLevel.EMERGENCY
    if level == 3:
        return SeverityLevel.CRITICAL
    return SeverityLevel.WARNING


class Strategy2Orchestrator:
    """Independent PROPOSED-strategy conductor (quality gate + sound exit config)."""

    def __init__(
        self,
        *,
        dal,
        selection_engine,
        risk_engine,
        risk_state_builder,
        portfolio_state,
        kill_switch_cache,
        sizing_policy: SizingPolicy,
        capital_settings: CapitalSettings,
        execution_target,
        operator_user_id: UUID,
        alert_manager=None,
        dlq=None,
        clock=None,
        exit_engine=None,
        min_score: Decimal = MIN_SCORE,
    ) -> None:
        self._dal = dal
        self._selection = selection_engine
        self._risk = risk_engine
        self._rsb = risk_state_builder
        self._portfolio = portfolio_state
        self._ks = kill_switch_cache
        self._sizing = sizing_policy
        self._capital = capital_settings
        self._target = execution_target
        self._user_id = operator_user_id
        self._alerts = alert_manager
        self._dlq = dlq
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        # independent exit engine (active Core profit exit) + transient exit-state.
        self._exit = exit_engine or Strategy2ExitEngine(proposed_exit_config())
        self._exit_states: dict[UUID, ExitState] = {}
        self._min_score = min_score
        self._regime_engine = MarketRegimeEngine()

    @classmethod
    def from_application(
        cls,
        app,
        *,
        execution_target,
        sizing_policy: SizingPolicy,
        capital_settings: CapitalSettings,
        operator_user_id: UUID,
        clock=None,
        exit_engine=None,
        min_score: Decimal = MIN_SCORE,
    ) -> "Strategy2Orchestrator":
        return cls(
            dal=app.dal,
            selection_engine=app.selection_engine,
            risk_engine=app.risk_engine,
            risk_state_builder=app.risk_state_builder,
            portfolio_state=app.portfolio_state,
            kill_switch_cache=app.kill_switch_cache,
            sizing_policy=sizing_policy,
            capital_settings=capital_settings,
            execution_target=execution_target,
            operator_user_id=operator_user_id,
            alert_manager=app.alert_manager,
            dlq=app.dlq,
            clock=clock,
            exit_engine=exit_engine,
            min_score=min_score,
        )

    # -- audit helpers ----------------------------------------------------- #
    def _audit(self, severity: SeverityLevel, detail: dict) -> None:
        detail = {"strategy": STRATEGY_NAME, **detail}
        emit_system_event(self._dal, SystemEventType.GATEWAY_EVENT, severity, detail)

    def _alert(self, severity: SeverityLevel, detail: dict) -> None:
        detail = {"strategy": STRATEGY_NAME, **detail}
        if self._alerts is not None:
            self._alerts.alert(SystemEventType.GATEWAY_EVENT, severity, detail)
        else:
            emit_system_event(self._dal, SystemEventType.GATEWAY_EVENT, severity, detail)

    # -- one cycle --------------------------------------------------------- #
    def run_cycle(self, frame) -> CycleResult:
        now = self._clock()

        level = int(self._ks.current_level())
        if level >= _L4:
            self._audit(_ks_severity(level),
                        {"kind": "kill_switch", "stage": "precheck", "level": level,
                         "action": "shutdown_no_new_activity"})
            return CycleResult(state=HALTED, reason="kill-switch L4: shutdown",
                               kill_switch_level=level)

        # exits first (risk-reducing; permitted L1–L3, halted only at L4).
        closed = self._run_exits(frame, now)

        if not frame.tradable:
            detail = {"kind": "data_quality_reject", "stage": "data",
                      "fatal_issues": list(frame.quality.fatal_issues),
                      "dropped": [list(d) for d in frame.quality.dropped],
                      "market_open": frame.market_open}
            self._alert(SeverityLevel.WARNING, detail)
            if self._dlq is not None:
                self._dlq.dead_letter(
                    item_type="cycle:data_quality",
                    payload={"bar_id": getattr(frame, "bar_id", None)},
                    reason="data-quality: " + ", ".join(frame.quality.fatal_issues),
                    correlation={"bar_id": getattr(frame, "bar_id", None)},
                )
            return CycleResult(state=REJECTED, kill_switch_level=level, closed=closed,
                               reason="data-quality reject: "
                               + ", ".join(frame.quality.fatal_issues))

        if level == _L1:
            self._audit(SeverityLevel.WARNING,
                        {"kind": "kill_switch", "stage": "scanner", "level": level,
                         "action": "pause_scanner"})
            return CycleResult(state=PAUSED_SCANNER, kill_switch_level=level,
                               closed=closed, reason="kill-switch L1: scanner paused")

        # SCAN + SCORE (D3)
        result = self._selection.run(
            frame.market_facts,
            list(frame.core_candidates),
            list(frame.turbo_candidates),
        )
        scored = list(result.core) + list(result.turbo)
        regime = result.regime.value if hasattr(result.regime, "value") else str(result.regime)

        # QUALITY GATE (Strategy 2 modification): keep only high-band signals.
        candidates = [c for c in scored if c.score >= self._min_score]
        self._audit(SeverityLevel.WARNING,
                    {"kind": "quality_gate", "stage": "selection", "regime": regime,
                     "scored": len(scored), "kept": len(candidates),
                     "dropped": len(scored) - len(candidates),
                     "min_score": str(self._min_score)})

        marks_by_instrument = self._marks_by_instrument(frame)
        self._portfolio.snapshot(marks_by_instrument, captured_at=now)
        daily_drawdown = self._realized_drawdown_since(
            now.astimezone(_NY).replace(hour=0, minute=0, second=0, microsecond=0)
        )
        weekly_drawdown = self._realized_drawdown_since(now - timedelta(days=7))
        open_instruments = self._open_instruments_map()

        res = CycleResult(state=COMPLETED, kill_switch_level=level, regime=regime,
                          scored=len(candidates), closed=closed)

        for cand in candidates:
            inst_id = self._resolve_instrument(cand.symbol)
            if inst_id is None:
                res.no_trade += 1
                self._audit(SeverityLevel.WARNING,
                            {"kind": "no_trade", "stage": "resolve",
                             "symbol": cand.symbol, "reason": "unknown instrument"})
                continue

            signal = Signal(id=uuid4(), created_at=now, instrument_id=inst_id,
                            engine=cand.engine, direction=cand.direction)
            self._dal.signals.add(signal)
            self._dal.scores.add(Score(
                id=uuid4(), signal_id=signal.id, engine=cand.engine,
                total=cand.score, classification=cand.classification,
                created_at=now, breakdown=dict(cand.breakdown)))

            instrument = self._dal.instruments.get_or_none(inst_id)
            sector_current = (
                self._portfolio.sector_exposure(
                    instrument.sector_id, open_instruments, marks_by_instrument
                ) if instrument is not None else Decimal("0")
            )
            state = self._rsb.build(
                daily_drawdown=daily_drawdown,
                weekly_drawdown=weekly_drawdown,
                candidate_sector_current_exposure=sector_current,
                candidate_sector_added_exposure=self._capital.allocation_fraction,
            )
            decision = self._risk.evaluate(state, cand)
            self._dal.risk_checks.add(RiskCheck(
                id=uuid4(), signal_id=signal.id, decision=decision.decision,
                created_at=now, rejected_by=decision.rejected_by))
            if not decision.accepted:
                res.no_trade += 1
                continue
            res.accepted += 1

            if level == 3:  # L3 pause-execution
                self._audit(SeverityLevel.CRITICAL,
                            {"kind": "kill_switch", "stage": "execution", "level": level,
                             "action": "pause_execution", "signal_id": str(signal.id)})
                res.no_trade += 1
                continue

            mark = frame.marks.get(cand.symbol)
            sizing = self._sizing.size(cand, self._capital, mark)
            if not sizing.tradable:
                res.no_trade += 1
                self._audit(SeverityLevel.WARNING,
                            {"kind": "no_trade", "stage": "sizing",
                             "symbol": cand.symbol, "reason": sizing.reason})
                continue

            intent = ExecutionIntent(signal=signal, user_id=self._user_id,
                                     quantity=sizing.quantity, mark=mark, at=now)
            outcome = self._target.handle_accepted(intent)
            res.outcomes.append(outcome)
            if outcome.executed and outcome.position is not None:
                self._portfolio.open_position(outcome.position)
                res.executed += 1

        self._audit(SeverityLevel.WARNING,
                    {"kind": "cycle_summary", "stage": "reporting", "regime": regime,
                     "scored": res.scored, "accepted": res.accepted,
                     "executed": res.executed, "no_trade": res.no_trade,
                     "closed": res.closed, "kill_switch_level": level})
        return res

    # -- exit stage -------------------------------------------------------- #
    def _run_exits(self, frame, now) -> int:
        open_positions = list(self._portfolio._open.list())
        if not open_positions:
            return 0
        market_open = bool(getattr(frame, "market_open", True))
        regime_is_bull = self._regime_is_bull(frame)   # per-cycle, read-only
        closed = 0
        for pos in open_positions:
            instr = self._dal.instruments.get_or_none(pos.instrument_id)
            mark = frame.marks.get(instr.symbol) if instr is not None else None
            state = self._exit.advance_state(
                self._exit_states.get(pos.id, ExitState.initial()), pos, mark)
            self._exit_states[pos.id] = state
            decision = self._exit.evaluate(ExitEvaluationContext(
                position=pos, mark=mark, state=state,
                regime_is_bull=regime_is_bull, trend_stage2=None,
                market_open=market_open, minutes_to_close=None))
            if not decision.close:
                continue
            try:
                closed_pos = self._target.handle_close(
                    pos, mark, user_id=self._user_id, at=now)
            except (ExecutionError, ValueError) as exc:
                self._audit(SeverityLevel.WARNING,
                            {"kind": "exit_error", "stage": "exit",
                             "position_id": str(pos.id), "reason": str(exc)})
                continue
            if closed_pos is None:
                continue
            self._portfolio.close_position(closed_pos)
            self._exit_states.pop(pos.id, None)
            closed += 1
            self._audit(SeverityLevel.WARNING,
                        {"kind": "exit_close", "stage": "exit",
                         "position_id": str(pos.id), "exit_reason": decision.reason,
                         "exit_price": str(closed_pos.exit_price)})
        return closed

    # -- D4 input figures (windowed, D6-computed) -------------------------- #
    def _realized_drawdown_since(self, window_start: datetime) -> Decimal:
        closed = self._dal.positions.list(status=PositionStatus.CLOSED)
        if not closed:
            return Decimal("0")
        ordered = sorted(closed, key=lambda p: (p.closed_at or _MIN_DT, p.opened_at))
        equity_at_start = self._portfolio.account.starting_capital
        running = equity_at_start
        in_window: list = []
        for pos in ordered:
            pnl = PnLCalculator.realized_for_position(pos)
            ca = pos.closed_at
            if ca is not None and ca < window_start:
                equity_at_start += pnl
                running = equity_at_start
            else:
                running += pnl
                in_window.append(running)
        peak = max([equity_at_start] + in_window)
        if peak <= Decimal("0"):
            return Decimal("0")
        return min((running - peak) / peak, Decimal("0"))

    def _open_instruments_map(self) -> dict:
        out: dict = {}
        for pos in self._portfolio._open.list():
            inst = self._dal.instruments.get_or_none(pos.instrument_id)
            if inst is not None:
                out[pos.instrument_id] = inst
        return out

    def _regime_is_bull(self, frame):
        """Per-cycle regime for the Core thesis exit (read-only reuse of D3).

        None when market_facts are absent (e.g. a withheld/closed frame) — the
        Core regime exit then holds (fail-safe); stop/trail still protect.
        """
        mf = getattr(frame, "market_facts", None)
        if mf is None or mf.spy_price is None or mf.spy_sma_200 is None:
            return None
        try:
            return self._regime_engine.evaluate(mf) == MarketRegime.BULL
        except (ArithmeticError, TypeError):
            return None

    def _resolve_instrument(self, symbol: str) -> Optional[UUID]:
        rows = self._dal.instruments.list(symbol=symbol)
        return rows[0].id if rows else None

    def _marks_by_instrument(self, frame) -> dict:
        out: dict = {}
        for pos in self._portfolio._open.list():
            instr = self._dal.instruments.get_or_none(pos.instrument_id)
            if instr is not None:
                mark = frame.marks.get(instr.symbol)
                if mark is not None:
                    out[pos.instrument_id] = mark
        return out


__all__ = ["Strategy2Orchestrator"]
