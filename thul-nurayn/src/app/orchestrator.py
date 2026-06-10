"""THUL-NURAYN v1 — P-ORCH autonomous pipeline orchestrator.

The SOLE autonomous conductor (P-ORCH_PIPELINE_ORCHESTRATOR_ARCHITECTURE.md). It
sequences the existing, already-tested components in the mandatory ordered chain
— and decides nothing itself:

  Scheduler → Data (P-DATA) → Selection (D3) → Risk (D4) → Size (P-SIZE)
            → Execution Target (D11) → Portfolio (D6) → Audit

Hard guarantees (per the ratified owner decisions):
  * Kill-switch is evaluated FIRST, highest priority (L1 pause-scan / L2 D4-block
    / L3 pause-execution / L4 shutdown); never decided here, only read.
  * Data-quality failure ⇒ Reject Cycle → Audit → Alert → No Trade.
  * Every stage leaves a durable audit trace (system_events / D1 rows / D5 audit).
  * No bypass: nothing reaches execution without clearing Selection→Risk→Sizing.
  * P-ORCH calls only existing public methods; it adds no strategy/score/risk/
    execution/allocation logic; PostgreSQL is the source of truth.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from src.enums import SeverityLevel, SystemEventType
from src.models import RiskCheck, Score, Signal
from src.operations.events import emit_system_event
from src.operations.scheduler import Worker

from .sizing import CapitalSettings, SizingPolicy
from .targets.base import ExecutionIntent

# -- cycle states (transient strings; not persisted, not a new enum) --------- #
IDLE = "IDLE"
HALTED = "HALTED"                 # kill-switch L4 / fatal
REJECTED = "REJECTED"            # data-quality cycle reject
PAUSED_SCANNER = "PAUSED_SCANNER"   # kill-switch L1
PAUSED_EXECUTION = "PAUSED_EXECUTION"  # kill-switch L3
COMPLETED = "COMPLETED"

# kill-switch level thresholds (data values; mirror the L1–L4 ladder).
_L1, _L2, _L3, _L4 = 1, 2, 3, 4


@dataclass
class CycleResult:
    """Transient outcome of one trading cycle (not persisted)."""

    state: str
    reason: str = "ok"
    kill_switch_level: int = 0
    regime: Optional[str] = None
    scored: int = 0
    accepted: int = 0
    executed: int = 0
    no_trade: int = 0
    outcomes: list = field(default_factory=list)


def _ks_severity(level: int) -> SeverityLevel:
    if level >= _L4:
        return SeverityLevel.EMERGENCY
    if level == _L3:
        return SeverityLevel.CRITICAL
    return SeverityLevel.WARNING


class PipelineOrchestrator:
    """Drives one trading cycle through the mandatory ordered chain."""

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
    ) -> "PipelineOrchestrator":
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
        )

    # -- audit helpers (durable; existing members only) -------------------- #
    def _audit(self, severity: SeverityLevel, detail: dict) -> None:
        emit_system_event(self._dal, SystemEventType.GATEWAY_EVENT, severity, detail)

    def _alert(self, severity: SeverityLevel, detail: dict) -> None:
        if self._alerts is not None:
            self._alerts.alert(SystemEventType.GATEWAY_EVENT, severity, detail)
        else:
            self._audit(severity, detail)

    # -- one cycle --------------------------------------------------------- #
    def run_cycle(self, frame) -> CycleResult:
        now = self._clock()

        # [0] PRECHECK — kill-switch FIRST (highest priority) ------------- #
        level = int(self._ks.current_level())
        if level >= _L4:
            self._audit(_ks_severity(level),
                        {"kind": "kill_switch", "stage": "precheck", "level": level,
                         "action": "shutdown_no_new_activity"})
            return CycleResult(state=HALTED, reason="kill-switch L4: shutdown",
                               kill_switch_level=level)

        # [1] DATA-QUALITY GATE — Reject Cycle → Audit → Alert → No Trade -- #
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
            return CycleResult(
                state=REJECTED,
                reason="data-quality reject: " + ", ".join(frame.quality.fatal_issues),
                kill_switch_level=level,
            )

        # [L1] kill-switch — pause scanner (skip scan/score) -------------- #
        if level == _L1:
            self._audit(SeverityLevel.WARNING,
                        {"kind": "kill_switch", "stage": "scanner",
                         "level": level, "action": "pause_scanner"})
            return CycleResult(state=PAUSED_SCANNER,
                               reason="kill-switch L1: scanner paused",
                               kill_switch_level=level)

        # [2/3] SCAN + SCORE (D3) ----------------------------------------- #
        result = self._selection.run(
            frame.market_facts,
            list(frame.core_candidates),
            list(frame.turbo_candidates),
        )
        candidates = list(result.core) + list(result.turbo)
        regime = result.regime.value if hasattr(result.regime, "value") else str(result.regime)
        self._audit(SeverityLevel.WARNING,
                    {"kind": "scan", "stage": "selection", "regime": regime,
                     "core": len(result.core), "turbo": len(result.turbo)})

        # portfolio snapshot → daily drawdown input for D4 (D6 computes) --- #
        marks_by_instrument = self._marks_by_instrument(frame)
        snapshot = self._portfolio.snapshot(marks_by_instrument, captured_at=now)

        res = CycleResult(state=COMPLETED, kill_switch_level=level, regime=regime,
                          scored=len(candidates))

        # [4] per-candidate: Risk → Size → Execute → Portfolio ------------ #
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

            # RISK (D4) — kill-switch L2 blocks here via KillSwitchGate ---- #
            state = self._rsb.build(daily_drawdown=snapshot.drawdown)
            decision = self._risk.evaluate(state, cand)
            self._dal.risk_checks.add(RiskCheck(
                id=uuid4(), signal_id=signal.id, decision=decision.decision,
                created_at=now, rejected_by=decision.rejected_by))
            if not decision.accepted:
                res.no_trade += 1
                continue
            res.accepted += 1

            # [L3] kill-switch — pause execution (accepted, not executed) -- #
            if level == _L3:
                self._audit(SeverityLevel.CRITICAL,
                            {"kind": "kill_switch", "stage": "execution",
                             "level": level, "action": "pause_execution",
                             "signal_id": str(signal.id)})
                res.no_trade += 1
                continue

            # SIZE (P-SIZE) ------------------------------------------------ #
            mark = frame.marks.get(cand.symbol)
            sizing = self._sizing.size(cand, self._capital, mark)
            if not sizing.tradable:
                res.no_trade += 1
                self._audit(SeverityLevel.WARNING,
                            {"kind": "no_trade", "stage": "sizing",
                             "symbol": cand.symbol, "reason": sizing.reason})
                continue

            # EXECUTE (D11 target → D5) ------------------------------------ #
            intent = ExecutionIntent(signal=signal, user_id=self._user_id,
                                     quantity=sizing.quantity, mark=mark, at=now)
            outcome = self._target.handle_accepted(intent)
            res.outcomes.append(outcome)

            # PORTFOLIO (D6 reflection) ------------------------------------ #
            if outcome.executed and outcome.position is not None:
                self._portfolio.open_position(outcome.position)
                res.executed += 1

        # [REPORTING] cycle summary audit --------------------------------- #
        self._audit(SeverityLevel.WARNING,
                    {"kind": "cycle_summary", "stage": "reporting", "regime": regime,
                     "scored": res.scored, "accepted": res.accepted,
                     "executed": res.executed, "no_trade": res.no_trade,
                     "kill_switch_level": level})
        return res

    # -- helpers ----------------------------------------------------------- #
    def _resolve_instrument(self, symbol: str) -> Optional[UUID]:
        rows = self._dal.instruments.list(symbol=symbol)
        return rows[0].id if rows else None

    def _marks_by_instrument(self, frame) -> dict:
        """Map open-position instrument_id → mark (symbol-keyed frame marks)."""
        out: dict = {}
        for pos in self._portfolio._open.list():  # read-only registry view
            instr = self._dal.instruments.get_or_none(pos.instrument_id)
            if instr is not None:
                mark = frame.marks.get(instr.symbol)
                if mark is not None:
                    out[pos.instrument_id] = mark
        return out


class TradingCycleWorker(Worker):
    """B8 worker: polls the P-DATA provider and runs ONE trading cycle per tick.

    Per-cycle failure isolation is provided by the B8 Scheduler. Starts only on
    explicit application start (B9 OD-D6).
    """

    name = "trading_cycle"

    def __init__(self, orchestrator: PipelineOrchestrator, provider,
                 *, interval: float = 60.0) -> None:
        self.interval = interval
        self._orch = orchestrator
        self._provider = provider
        self.last_result: Optional[CycleResult] = None

    def run_once(self) -> None:
        if self._provider.exhausted():
            return
        frame = self._provider.poll()
        self.last_result = self._orch.run_cycle(frame)


__all__ = [
    "PipelineOrchestrator",
    "TradingCycleWorker",
    "CycleResult",
    "IDLE", "HALTED", "REJECTED", "PAUSED_SCANNER", "PAUSED_EXECUTION", "COMPLETED",
]
