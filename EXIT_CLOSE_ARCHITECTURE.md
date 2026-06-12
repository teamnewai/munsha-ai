# EXIT_CLOSE_ARCHITECTURE

**Type:** Architecture document. **No implementation. No code changes. No schema changes. No tests.**
**Status:** **DRAFT — awaiting owner approval.** Authorized by owner decision "Option A approved" (resolves `OR2_EXIT_PATH_BLOCKER.md` §6).
**Scope:** Design the missing position-**exit decision** and position-**close execution** required by the approved strategy, `OWNER_PROFIT_POLICY`, D14 reporting, and the first Validation Campaign.
**Grounding:** Every structural claim below was verified from source (D1 `Position`, D5 `PositionStateMachine`/`ExecutionEngine`, D6 `PortfolioState`/`PnLCalculator`, P-ORCH `PipelineOrchestrator`, D11 `PaperTarget`, D14 `metrics`). File/line citations are given inline.

**Invariants preserved (design constraints, not yet built):** PostgreSQL sole source of truth · Redis non-authoritative · D3 Score Engine = single source of truth for *entry* selection · **Portfolio ⟂ Risk ⟂ Execution** · no new tables · no new enums · no schema changes · history immutable (no retroactive recalculation) · no broker / TradingView / IBKR / live trading · no paper-only shortcut exit · no fixed-profit-target forced exit (`OWNER_PROFIT_POLICY` Rules 1–5).

---

## 0. Why this phase exists (one paragraph)

The autonomous pipeline today **opens positions and never closes them** (`PaperTarget.handle_accepted` creates `PositionStatus.OPEN` and returns — `src/app/targets/paper.py:82-92`; P-ORCH `run_cycle` ends at `portfolio.open_position` — `src/app/orchestrator.py:257-259`). Validation **measures closed round-trips** (`metrics._closed_sorted` → `positions.list(status=CLOSED)`). The two never meet, so a replay produces 0 closed trades and the Validation gate cannot be evaluated. This phase designs the missing leg: a **decision** ("should this open position close now?") and an **execution** ("close it, record the exit, reflect it in the portfolio"). It adds a capability; it changes no existing rule, formula, schema, or historical record.

---

## 1. Design principles (what the exit leg must obey)

1. **Symmetry with entry, not a copy of it.** Entry flows D3 (decide) → D4 (risk) → P-SIZE (size) → D11/D5 (execute) → D6 (reflect). Exit flows **Exit Decision** (decide) → D5 close-execution (execute) → D6 reflect (`close_position`). Exit needs no sizing (quantity is the open position's quantity) and no entry-risk gate (closing reduces exposure, it never adds).
2. **Decision and execution stay separated** (preserves Portfolio ⟂ Risk ⟂ Execution). The component that *decides* to exit owns no order mechanics; D5 owns the close mechanics; D6 only reflects. No layer gains a second responsibility.
3. **Full closes only.** `OWNER_PROFIT_POLICY` Rule 7 defers partial-profit-taking to a separate review. v1 exit closes the **entire** position or holds it. This matches `PositionStateMachine` which has exactly `OPEN → CLOSED` and no partial state (`src/execution/state_machines.py:43-46`).
4. **Profit policy is law.** No fixed profit % may force an exit (Rules 1, 4). Profit % is reporting only (Rule 5). Winners run while exit conditions do not fire (Rule 2). The exit is governed by the **approved exit methodology** (trailing-stop primary, Rule 3) — see §4 and the **critical input gap** in §11.
5. **Reuse what exists; invent the minimum.** Open→Closed transition (D5), `close_position` reflection (D6), realized-PnL formula (D6), `Position.exit_price`/`closed_at` fields (D1) **already exist** and are reused verbatim. The genuinely new pieces are: (a) an Exit Decision component, (b) a D5 position-close execution method, (c) an exit stage in P-ORCH, (d) a close capability on the execution target.
6. **Determinism & audit.** Every exit evaluation (CLOSE *or* HOLD) leaves a durable audit trace, exactly as the entry stages do (`orchestrator._audit`).

---

## 2. Component model (new + reused)

| Component | Status | Role in exit leg |
|---|---|---|
| **Exit Decision Engine** (new, strategy layer) | **NEW — future build** | Pure function over (open position, current mark, position's exit-state) → `CLOSE` or `HOLD` + reason. Owns the trailing-stop / approved exit methodology. Decides; never executes. Parallel to D3 (D3 selects entries; this selects exits). |
| **Position exit-state** (derivation) | **NEW — future build, NO schema change** | The trailing-stop high-water reference and any per-position exit state are **derived deterministically from durable facts** (entry price, direction, the position's fill/mark history) at evaluation time — *not* a new persisted column. See §5 + §7. |
| **D5 close-execution method** (new method on `ExecutionEngine`) | **NEW — future build** | Executes a close: create+submit the closing (exit) order via existing order flow, transition the **position** `OPEN → CLOSED` via existing `PositionStateMachine`, stamp `exit_price`/`closed_at`, `positions.update(...)`. Mirrors `apply_fill` discipline (verify, validate, audit). |
| **Execution-target close capability** (extend `ExecutionTarget`) | **NEW — future build** | Paper target simulates the closing fill at the supplied mark (symmetric to `handle_accepted`), delegating mechanics to the new D5 method. SignalsOnly emits a close *signal* and executes nothing. |
| **P-ORCH exit stage** (new stage in `run_cycle`) | **NEW — future build** | Before/after the entry loop, iterate open positions, call Exit Decision, and on `CLOSE` route through the target's close capability, then `portfolio.close_position`. |
| `PositionStateMachine` (D5) | **REUSE — unchanged** | `OPEN → CLOSED` already legal (`state_machines.py:43-46`). |
| `PortfolioState.close_position` (D6) | **REUSE — unchanged** | Moves open→closed registry, updates cash by realized PnL (`portfolio/state.py:54-66`). |
| `PnLCalculator.realized_for_position` (D6) | **REUSE — unchanged** | Long `(exit−entry)·qty` / Short `(entry−exit)·qty` (`calculators.py:29-42`). |
| `Position.exit_price`, `Position.closed_at` (D1) | **REUSE — unchanged** | Already exist, nullable (`models/__init__.py:174-175`). No schema change. |
| D14 metrics/report/gate | **REUSE — unchanged** | Already measures CLOSED positions. **No modification** (owner constraint). It simply starts seeing non-empty input. |

---

## 3. Exit lifecycle (the decision)

The Exit Decision Engine runs **per open position, per cycle**, after data-quality passes and marks are available. It is a pure evaluation:

```
evaluate(open_position, current_mark, derived_exit_state) -> ExitDecision
    ExitDecision ∈ { HOLD(reason), CLOSE(reason, exit_reference_price) }
```

Sequence per open position:

1. **Mark availability.** If no current mark for the instrument → **HOLD** (fail-safe: never close on missing data; mirrors D6/P-SIZE "missing mark ⇒ no action"). Audit `exit_eval / no_mark`.
2. **Derive exit-state** from durable facts (entry price, direction, mark history within the run) — e.g., the trailing high-water reference for a long. Deterministic; see §5.
3. **Apply approved exit methodology** (trailing-stop primary, Rule 3). Profit % is *observed and reported* but never the trigger (Rules 1, 4, 5).
4. **Emit decision**: `HOLD` (winner keeps running, Rule 2) or `CLOSE` with the exit reference price = the supplied current mark (symmetric to entry, which fills at the supplied mark — `paper.py:62-63`, OD-4 "no slippage").
5. **Audit** every evaluation (CLOSE and HOLD), with reason and the values that drove it.

The decision engine **never** mutates state, **never** writes orders, **never** touches the portfolio. It returns a value object. (Mirrors D3/D4 purity.)

---

## 4. Trailing-stop behavior (governed by the approved methodology)

Per `OWNER_PROFIT_POLICY`:
- **Trailing-stop is the primary profit-protection mechanism** (Rule 3); it is what arms and fires the CLOSE.
- **No fixed profit target forces an exit** (Rules 1, 4): the trail does not have a "+30% → sell" rung; +30% (and any profit %) is **reporting only** (Rule 5).
- **Winners run** (Rule 2): while price keeps moving favorably, the trail's reference advances and the position stays OPEN.
- **Full close on trigger** (Rule 7): when the trail is violated, the **entire** position closes; no scale-out.

**Behavioral shape (direction-aware, parameters TBD by owner — see §11):**
- *Long:* maintain a high-water reference of the favorable mark; CLOSE when mark retraces from that reference by the approved trail distance.
- *Short:* maintain a low-water reference; CLOSE when mark rises from that reference by the approved trail distance.

**CRITICAL:** the **concrete trail parameters** (distance/percentage/ATR-multiple, arming condition, any time-stop or hard protective stop, and whether the trail is %-based or volatility-based) are **NOT present anywhere in the repository** (verified: grep for `trailing|stop|exit|ATR|chandelier` across `src/` returns only the B5 note that a position "remains Open until closed by a later (exit) order/flow" — `B5_EXECUTION_ARCHITECTURE.md:102` — and the policy's affirmation of trailing-stop as *primary*, with no numbers). These parameters **must be transcribed from the owner-held approved Master Spec**, not invented by implementation. This is the single largest input dependency of this phase (Risk R-1, Assumption A-1).

---

## 5. Position-state transitions

**Order-status transitions (closing order)** — reuse `OrderStateMachine` unchanged (`state_machines.py:18-39`):
```
NEW → SENT → FILLED      (the closing/exit order; identical legal path to an entry order)
```
The closing order is a normal `Order` (a *sell* to close a long, a *buy* to close a short). Direction representation of the closing order is an implementation detail of the D5 close method (it must not violate `OrderValidationLayer`); the **position's** `direction` field is immutable and remains the original (Long/Short) so realized-PnL math stays correct (`calculators.py:40-42`).

**Position-status transition** — reuse `PositionStateMachine` unchanged (`state_machines.py:43-46`):
```
OPEN → CLOSED            (the only legal position transition; no partial state)
```
On close, the position row is **updated in place** (not duplicated): `status=CLOSED`, `exit_price=<exit reference>`, `closed_at=<cycle time>`, via `positions.update(...)` (Repository contract `repository.py:42,119`). This is a forward write of fields that were previously null — **not** a retroactive recalculation of historical results (history-immutability honored; entry price/quantity/fills are never altered).

**Portfolio reflection** — reuse `PortfolioState.close_position` unchanged (`state/state.py:54-66`): removes from open registry, adds to closed registry, advances cash by `realized_for_position`. HWM/drawdown update on the next `snapshot()` exactly as today.

State diagram:
```
                 entry (existing, unchanged)                exit (NEW leg)
candidate ─► D3 ─► D4 ─► P-SIZE ─► D11/D5 ─► Position(OPEN) ─► [Exit Decision: HOLD]──┐ (loops each cycle, winner runs)
                                                  ▲                                   │
                                                  └───────────────────────────────────┘
                                              [Exit Decision: CLOSE]
                                                  │
                                                  ▼
                              D5 close-exec: NEW→SENT→FILLED (exit order) + OPEN→CLOSED (position)
                                                  │            stamp exit_price, closed_at; positions.update
                                                  ▼
                              D6 close_position → realized PnL → cash → (D14 now sees a closed trade)
```

---

## 6. Close lifecycle (the execution)

When the Exit Decision returns `CLOSE`, the close executes through a **new D5 method** (working name `close_position_execution`) that mirrors the rigor of `apply_fill` (`engine.py:72-78`):

1. **Verify** the position is `OPEN` (reuse `position_verifier`); refuse to close an already-closed/foreign position (idempotency — see §8).
2. **Create + submit** the closing order via the existing order flow (`create_order` → `submit_order`), tagged like paper entries (`broker_ref="paper:<uuid>"`, OD-5, no schema change). The closing order's quantity = the position's quantity (full close).
3. **Simulate the closing fill** at the supplied mark (paper target; OD-4, no slippage), append the `Fill` (reuse fill validation), transition order `SENT → FILLED`.
4. **Transition the position** `OPEN → CLOSED` (reuse `PositionStateMachine`), stamp `exit_price`/`closed_at`, `positions.update(...)`.
5. **Emit audit** for the close (order events + a P-ORCH `exit_close` cycle event).
6. **Return** an outcome the orchestrator hands to `portfolio.close_position`.

Execution-target symmetry:
- **PaperTarget** gains a close path (`handle_close(intent)` analogous to `handle_accepted`) that delegates mechanics to the new D5 method. It is *not* a paper-only shortcut: the close path is the **same D5 mechanism** the live targets will later use; paper only *simulates the fill* (the one thing paper is permitted to simulate, exactly as it does for entries — `paper.py:7-9, 81`).
- **SignalsOnly** emits a close *signal*/audit and executes nothing (it never opened a real position; symmetric to its entry behavior).
- **TradingView / IBKR** remain `NotImplementedError` (forbidden until separately gated).

---

## 7. Recovery requirements

Constraint: **no schema change**, so the exit-state (trailing reference) cannot be a new persisted column. Two facts make this safe:

1. **Closed positions are durable and complete.** Once `OPEN → CLOSED` is written (`status/exit_price/closed_at`), the trade is fully reconstructible from PostgreSQL; B9 recovery already replays closed rows into `PortfolioState` (`recovery.py` `state.close_position(pos)` for already-closed rows). No exit-state is needed for a position that already closed.
2. **Open positions' exit-state is re-derivable, not recovered.** After a crash/restart, the trailing reference for a still-open position is **re-derived deterministically** from durable facts (entry price, direction) plus the marks the provider replays forward. v1's mark stream is a deterministic replay (P-DATA `ReplayMarketDataProvider`), so re-derivation is reproducible.

**Recovery risk to flag (R-2):** if the trailing reference depends on the *peak mark observed since entry* and that peak occurred **before** a restart, a pure forward replay after restart may rebuild the reference from a lower starting point (the pre-crash peak is transient, not persisted). For the v1 **deterministic replay** campaign this is benign (the run restarts from the fixture's beginning, so the full mark history is re-observed). For any future **live** stream it would be a real gap requiring either (a) a schema-bearing future phase to persist the reference, or (b) reconstruction from persisted marks/fills. This phase **explicitly scopes the no-persisted-exit-state approach to the deterministic replay campaign** and flags live-mode persistence as a separate, later, schema-gated decision.

---

## 8. Audit requirements

Every exit action is durably traced, matching the entry stages' audit density (`orchestrator._audit` → `system_events`, and D5 `audit.order_event`):

| Event | When | Captured |
|---|---|---|
| `exit_eval` (HOLD) | every open position that stays open | position id, instrument, mark, derived reference, "winner running" reason |
| `exit_eval` (no_mark) | open position with missing mark | position id, instrument, "held: no mark" |
| `exit_eval` (CLOSE) | decision to close | position id, instrument, mark, reference, trail-violation reason, exit reference price |
| order events | closing order create/submit/fill | reuse existing D5 `order_event` |
| `exit_close` (cycle) | after a successful close | position id, order id, exit_price, realized PnL, closed_at |
| `exit_summary` | end of exit stage each cycle | counts: evaluated / held / closed |

No new audit *table* or *enum*: events use the existing `SystemEventType.GATEWAY_EVENT` channel P-ORCH already uses (`orchestrator.py:133`) and existing D5 audit; closing orders/fills/positions are the existing D1 rows.

---

## 9. Validation impact

- **D14 unchanged** (owner constraint honored). It already reads CLOSED positions; it simply begins receiving real ones.
- **Trades become real round-trips.** P-VALIDATION §4 ("Trades = closed paper positions") becomes satisfiable: an entry + a matching close = one closed `Position` with non-null `exit_price`/`closed_at`, which D14's `_closed_sorted` and `StatisticsCalculator` already count.
- **All policy gates become evaluable** (≥200 trades, win-rate, profit factor, max drawdown ≤10%, recovery, positive return) — previously unreachable per `OR2_EXIT_PATH_BLOCKER.md` §2. *Evaluable* ≠ *passing*; whether the strategy meets the thresholds is the campaign's job, and depends on the §11 trail parameters being the real approved ones.
- **OR-2 fixtures unblocked.** Once a close path exists, fixtures that feed a forward mark path will produce genuine closes (a fixture must carry enough forward marks to let the trail arm and fire). OR-2 remains paused until this phase is approved + built; this phase does **not** author fixtures, modify D14, or redefine "trade."
- **Profit-policy compliance is testable.** A validation/assurance check can assert no position closed solely due to reaching a profit % (Rules 1, 4) — i.e., closes are always trail-driven.

---

## 10. Dependency map

```
Master Spec exit methodology + parameters (OWNER-HELD)  ──(transcribe)──►  Exit Decision Engine (NEW, strategy)
OWNER_PROFIT_POLICY (no fixed target, winners run, full close) ───────────►  Exit Decision Engine
P-DATA marks (ReplayMarketDataProvider) ──────────────────────────────────►  Exit Decision Engine (current mark)
D1 Position(entry_price, direction, exit_price, closed_at) ───────────────►  Exit-state derivation + close write
        │
        ▼
P-ORCH run_cycle  ──(new exit stage)──►  ExecutionTarget.handle_close ──►  D5 close-execution method (NEW)
                                                                              │  reuse OrderStateMachine, PositionStateMachine,
                                                                              │  position_verifier, fill validation, audit
                                                                              ▼
                                                                         positions.update (status/exit_price/closed_at)
                                                                              │
                                                                              ▼
                                                              D6 PortfolioState.close_position (REUSE)
                                                                              │  realized PnL (PnLCalculator, REUSE)
                                                                              ▼
                                                              D14 metrics/report/gate (REUSE, sees closed trades)
B9 recovery (REUSE) ◄── replays CLOSED rows; OPEN exit-state re-derived (§7)
```
**Depends on (all existing, unchanged):** D1, D5, D6, D14, P-DATA, P-ORCH, D11, B9.
**Depended on by:** OR-2 (fixtures), the Validation Campaign, Paper Target.
**No new third-party dependency. No new table. No new enum.**

---

## 11. Critical input dependency (must resolve before implementation)

**The approved exit methodology's concrete parameters are not in the repository.** The codebase contains the *machinery* to close (D5 transition, D6 reflection, D1 fields) and the *governance* (no fixed target, winners run, trail primary) — but **zero numeric exit parameters**. Implementation cannot proceed faithfully without the owner supplying, from the approved Master Spec:

1. Trail type (fixed % / ATR-multiple / other) and **value(s)**, per engine (Core Swing vs Turbo Intraday may differ).
2. **Arming condition** (does the trail engage immediately at entry, or only after a threshold move?).
3. Any **hard protective stop** (initial stop-loss) distinct from the trail.
4. Any **time-based exit** (e.g., Turbo intraday end-of-session flat) — Turbo is "intraday," which usually implies a session close; this must be confirmed, not assumed.
5. Confirmation that **full-close-only** (no partial) is correct for v1 (consistent with Rule 7).

Until these are provided, implementation would be **inventing strategy** — forbidden. This is recorded as Risk R-1 / Assumption A-1 and is a hard gate on the build phase (§14).

---

## 12. Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| **R-1** | Exit/trail **parameters absent from repo**; implementing would invent strategy. | **High** | Owner must transcribe parameters from the approved Master Spec before any build (§11). Build phase blocked until supplied. |
| **R-2** | Trailing reference is transient (no persisted column); a live restart could rebuild it from a lower peak (§7). | Medium | Scope no-persist approach to the **deterministic replay** campaign (re-observes full history). Flag live-mode persistence as a separate, schema-gated future decision. |
| **R-3** | Kill-switch could **trap** open positions (block exits along with entries), preventing risk-reducing closes. | Medium | Design rule: **exits are risk-reducing and must be permitted** at L1–L3 (which restrict *new* exposure); only **L4 emergency shutdown** halts all activity. The exit stage must read the kill-switch with this asymmetry. Owner to confirm (Decision OD-E1, §13). |
| **R-4** | Closing-order direction vs `OrderValidationLayer` (a long is closed by a *sell*); a naive close could trip duplicate-protection or validation. | Medium | Reuse D5's existing validation; the close is a distinct order (new `signal_id`/`broker_ref`); duplicate-protection fingerprint `(signal_id, instrument_id, engine, direction)` is satisfied because the closing order is a separate signal. Implementation detail confirmed at build. |
| **R-5** | Exit stage adds per-cycle work over all open positions (O(open)). | Low | Bounded by max concurrent positions (risk-gated at entry); deterministic; no I/O beyond existing reads. |
| **R-6** | Misreading "winners run" as "never close winners." | Low | Policy is explicit: winners run *until the trail fires* (Rule 2 + Rule 3). The trail closes winners too — it protects profit. Audit reasons must distinguish "held: trail intact" from "closed: trail violated." |
| **R-7** | Fixture must carry enough forward marks for the trail to arm/fire, else closes never happen and OR-2 still yields 0 trades. | Medium | OR-2 fixture design (separate, paused phase) must encode forward mark paths sufficient to exercise both HOLD and CLOSE; called out as an OR-2 input once this phase lands. |

---

## 13. Assumptions & owner decisions required

**Assumptions (to be confirmed):**
- **A-1:** The approved exit methodology + parameters exist in the owner-held Master Spec and will be supplied verbatim (§11). *This is the blocking assumption.*
- **A-2:** v1 exits are **full-close only** (partial deferred, Rule 7).
- **A-3:** Exit reference (fill) price = the supplied current mark, no slippage (symmetric to entry, OD-4).
- **A-4:** No schema change; exit-state is derived, not persisted (acceptable for the deterministic replay campaign, §7/R-2).
- **A-5:** Closing orders reuse the existing paper `broker_ref` convention (OD-5); no new tag/field.

**Owner decisions requested (gating the build):**
- **OD-E1 (kill-switch asymmetry):** Confirm exits are **permitted at L1–L3** (risk-reducing) and only halted at **L4**. *(Recommended: yes.)*
- **OD-E2 (Turbo time-exit):** Confirm whether Turbo Intraday positions must be **force-flat at session end**, and if so the rule. *(Needs Master Spec.)*
- **OD-E3 (hard stop):** Confirm whether an initial protective stop exists alongside the trail, or the trail is the sole exit.
- **OD-E4 (per-engine parameters):** Provide Core vs Turbo trail parameters (§11 items 1–3).
- **OD-E5 (scope of close path):** Confirm the close path is built as the **shared D5 mechanism** (paper simulates the fill only), explicitly **not** a paper-only construct — consistent with the owner's "no paper-only shortcut exit."

---

## 14. Required future implementation phases (review-gated, in order)

Each phase is architecture-approved already by *this* document's acceptance, but each still produces a build report + independent compliance audit + test results before the next begins (the established discipline). **None starts until §11 parameters + §13 decisions are supplied.**

| Phase | Name | Deliverable | Touches | Gate |
|---|---|---|---|---|
| **EX-1** | **Exit Decision Engine** | New strategy-layer pure component (decide CLOSE/HOLD per approved methodology) + tests | New file(s) only; no frozen layer | Needs §11 params + OD-E1..E4 |
| **EX-2** | **D5 close-execution method** | New `ExecutionEngine` close method (order NEW→SENT→FILLED + position OPEN→CLOSED + `positions.update`) + tests | D5 additive method; reuses state machines/validation/audit | After EX-1; OD-E5 |
| **EX-3** | **Execution-target close capability** | `ExecutionTarget.handle_close`; PaperTarget simulates closing fill; SignalsOnly emits close signal | D11 additive; no live targets | After EX-2 |
| **EX-4** | **P-ORCH exit stage** | New exit-evaluation stage in `run_cycle` (iterate open positions → decide → close → `portfolio.close_position`) + audit + tests | P-ORCH additive stage; honors OD-E1 kill-switch asymmetry | After EX-3 |
| **EX-5** | **End-to-end exit verification** | Smoke test: entry → forward marks → trail fires → CLOSED position → D14 sees a real closed trade + realized PnL | Tests only | After EX-4 |

After EX-5, **OR-2 (fixtures) resumes** with mark paths that exercise HOLD and CLOSE, then the first Validation Campaign can run for real.

*(A later, separately-gated, schema-bearing phase would be required only if live-mode trailing-state persistence is wanted — out of scope here, R-2.)*

---

## 15. Definition of Done (for this architecture phase)

This **architecture** is Done when:
1. The exit **decision** lifecycle is specified (§3) and bound to `OWNER_PROFIT_POLICY` (no fixed target, winners run, full close).
2. The **close** lifecycle is specified as the shared D5 mechanism (§6), not a paper-only shortcut.
3. **Trailing-stop behavior** is described in shape and explicitly flagged as parameter-blocked on the Master Spec (§4, §11).
4. **Exit decision ownership** is assigned (new strategy-layer Exit Decision Engine; D5 executes; D6 reflects) with separation preserved (§1, §2).
5. **Position-state transitions** are mapped to existing, unchanged D5 machines and D1 fields (§5).
6. **Audit, recovery, validation impact, dependency map** are specified (§7–§10).
7. **Risks, assumptions, owner decisions, and the required future phases** are enumerated (§11–§14).
8. **No code, no schema, no tests** were produced; no frozen layer touched (this document only).

**Definition of Done for the eventual implementation (EX-1…EX-5), for reference:** open positions close per the approved trail; closed positions carry `exit_price`/`closed_at`; D6 cash reflects realized PnL; D14 counts real round-trips and the gate is evaluable; every exit is audited; kill-switch L4 halts exits while L1–L3 permit them; replay recovery reproduces exit-state; full suite green; frozen layers' diffs empty except the sanctioned additive D5/D11/P-ORCH/strategy additions.

---

## 16. Stop gate

**STOP — architecture only. Awaiting owner approval.**

No implementation, no code, no schema, no tests, no fixtures. D14 / P-VALIDATION untouched. No paper-only shortcut exit. No broker / TradingView / IBKR / live trading. The build (EX-1…EX-5) and OR-2 remain paused until: (a) this architecture is approved, **and** (b) the approved exit methodology parameters (§11) and owner decisions (§13) are supplied.
