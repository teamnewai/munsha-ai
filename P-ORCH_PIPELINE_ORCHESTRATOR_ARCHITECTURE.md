# P-ORCH_PIPELINE_ORCHESTRATOR_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No implementation. No tests. No source changes. No schema changes.**
**Derived from:** approved B1–B9 / D10–D14A artifacts · `P_DATA_MARKET_DATA_ARCHITECTURE.md` · D3 `facts.py`/`engine.py` · D4 `engine.py`/`state.py` · D11 targets · B8 scheduler/kill-switch/DLQ · B9 bootstrap/recovery · `B9_OWNER_POLICY_UPDATE.md` · `OWNER_PROFIT_POLICY.md`.
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** P-ORCH — the autonomous trading-pipeline orchestrator (the conductor that drives the first autonomous paper-trading run).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **P-ORCH is the SOLE autonomous conductor — all trading flow passes through it, and no component bypasses Selection → Risk → Sizing → Execution → Portfolio** · **no strategy / score / risk / execution-rule / allocation-policy modifications** · **no auto-tuning, no ML decisioning, no automatic parameter changes** · **D14A recommendations remain human-gated** · capital/allocation **owner-controlled, editable outside market hours only** · no new tables · no new enums · no schema changes · **no modification to D1–D14A**.

---

## 0. Ratified Owner Decisions (LOCKED)

The following owner decisions are **approved and binding** for P-ORCH. Where they refine the body of this document, this section governs.

| # | Ratified decision | Reflected in |
|---|-------------------|--------------|
| **1** | **P-ORCH is the ONLY autonomous conductor**; all trading flow passes through it. | §1, §2, §10 |
| **2** | **No component may bypass** `Selection → Risk → Sizing → Execution → Portfolio`. | §2 (mandatory ordered chain) |
| **3** | **Kill-switch has highest priority.** When activated: **no new positions · no new orders · existing state preserved · full audit event recorded.** | §9 |
| **4** | **Restart recovery is mandatory:** restore portfolio state, open positions, pending orders, **scheduler state**; **resume safely without duplicate actions**. | §7 |
| **5** | **Every stage produces audit events:** Scan · Score · Risk · Sizing · Execution · Portfolio · Recovery · Kill-Switch. | §8 |
| **6** | **Data-quality failures from P-DATA immediately STOP the affected cycle** (Missing Price · Invalid Volume · Duplicate Bar · Stale Data · Market Closed) → **Reject Cycle → Alert → No Trade.** | §4 |
| **7** | **Owner-approved capital settings are authoritative;** P-ORCH **reads current settings only**; **no hardcoded capital**; **no automatic capital changes**. | §3 |
| **8** | **Capital/allocation editable outside market hours only;** P-ORCH reads the **latest approved values on the next session**. | §3 |
| **9** | **D14A recommendations are advisory only;** no recommendation may automatically modify strategy, risk, sizing, scoring, or execution. | §10, §12 |
| **10** | **Profit policy unchanged:** no fixed profit target · winners may run · exit methodology authoritative · profit % are reporting metrics only. | §9, §10 |
| **11** | **DoD must include:** full autonomous paper-trading loop · recovery validation · kill-switch validation · audit validation · failure-path validation · scheduler validation. | §15 |

---

## 1. Purpose & Stance

P-ORCH is the **conductor**: it calls the already-built, already-tested components **in order**, once per trading cycle, with hard safety gates between stages. It **adds no domain logic** — it scores nothing, decides no risk, changes no rule, tunes nothing. Every decision stays in its owning layer: **D3 scores, D4 decides, D5 executes, D6 computes**. P-ORCH only sequences them, reads owner settings, enforces data-quality and kill-switch gates, records audit, and fails safe.

P-ORCH consumes the P-DATA `MarketDataFrame` and produces real domain rows via the existing engines. With `EXECUTION_TARGET=signals` it is a live signal pipeline; with `EXECUTION_TARGET=paper` it is the **autonomous paper-trading run**.

**Sole-conductor mandate (Owner Decision 1, 2):** P-ORCH is the **only** autonomous conductor. **All** trading flow passes through it, and **no component may bypass** the ordered chain `Selection → Risk → Sizing → Execution → Portfolio`. There is no side path that reaches execution without first clearing scoring, risk, and sizing; there is no execution that is not reflected in the portfolio. Targets, recovery, intelligence, and operations components are **invoked by** P-ORCH (or operate read-only beside it) — none initiates a trade on its own.

---

## 2. End-to-End Orchestration Design (requirement 1)

The pipeline, one cycle, each arrow a **fail-safe gate**:

```
[0] Pre-cycle gate ─ market open? kill-switch? health? settings loaded?
      │ (else: NO-TRADE, audit, end cycle)
      ▼
[1] Market Data ............ pull latest P-DATA MarketDataFrame
      │  DATA-QUALITY GATE (req 14): missing price / invalid volume /
      │  duplicate bar / stale / market closed  → Reject → Alert → No Trade
      ▼
[2] Candidate Generation ... P-DATA core[]/turbo[] candidate facts (valid subset)
      ▼
[3] Score Engine (D3) ...... SelectionEngine.run(market_facts, core, turbo)
      │  → regime + ranked ScoredCandidate[] (+ breakdown)  [D3 owns scoring]
      ▼
[4] Risk Gate (D4) ......... per candidate: RiskStateBuilder.build(...) →
      │  RiskDecisionEngine.evaluate(state, candidate)  [D4 owns the decision;
      │  kill-switch L2+ blocks new trades HERE via D4's KillSwitchGate]
      │  → ACCEPTED candidates only proceed
      ▼
[5] Position Sizing ........ SizingPolicy.size(candidate, owner_capital_settings, mark)
      │  reads CURRENT owner capital/allocation (req 12,13); fixed allocation
      │  (V2-001, unchanged); never hardcoded → quantity  (0/invalid → No Trade)
      ▼
[6] Execution Target (D11) .. ExecutionTarget.handle_accepted(
      │     ExecutionIntent{signal, user_id, quantity, mark})
      │  signals→record only; paper→D5 create→submit→fill  [D5 owns execution]
      ▼
[7] Fill Processing (D5) .... fills persisted; order→FILLED; broker_ref="paper:"
      ▼
[8] Portfolio Update (D6) ... PortfolioState.open/close + snapshot(marks)
      │  [D6 owns PnL/equity/HWM/drawdown; marks supplied]
      ▼
[9] Performance Tracking .... StatisticsCalculator → persist_stats → performance_records
      ▼
[10] Trade Intelligence (D14A) recommendations ONLY; human-gated; applies nothing
      ▼
   end cycle → audit cycle outcome → IDLE
```

**Persistence at each stage** is via the single B9 `PostgresDataAccessLayer` (Signals/Scores, Orders/Fills/Positions, performance_records, market_snapshots) — PostgreSQL is truth. P-ORCH calls **only existing public methods**; it reimplements none.

**Boundary guarantees:** P-ORCH never computes a score (stage 3 = D3), never makes a risk decision (stage 4 = D4), never transitions an order/position itself (stage 6–7 = D5), never computes portfolio figures (stage 8 = D6), and never changes a parameter (stage 10 = advisory only).

---

## 3. Position Sizing (requirements 12, 13)

- A **`SizingPolicy`** component computes order quantity from the **fixed allocation methodology** (V2-001, unchanged — no risk-based sizing): `quantity = floor( allocation_fraction × capital ÷ mark )`.
- It **reads the current owner-defined capital/allocation settings** at cycle start (env/config per B9 OD-D1 + `B9_OWNER_POLICY_UPDATE`). **No value is hardcoded.**
- Settings are **owner-controlled and editable outside market hours only** (req 12; `B9_OWNER_POLICY_UPDATE` change-window: before session OR ≥30 min after After-Hours close, forward-only). P-ORCH **reads** the current effective values; the change-window is enforced by the settings layer — P-ORCH never mutates settings and never trades on a mid-session change.
- `mark` comes from the P-DATA frame; **missing mark → No Trade** for that instrument (data-quality block, §6). Quantity ≤ 0 or unaffordable → No Trade (audited).
- Sizing changes **nothing** in D3/D4/D5/D6; it only turns an accepted candidate + capital + price into a quantity. *(Whether `SizingPolicy` is a sub-module of P-ORCH or a sibling "P-SIZE" component is OD-PORCH-2; either way it reads config and applies the fixed policy.)*

---

## 4. Data-Quality Blocking (requirement 14)

A **hard gate before scoring** (stage 1). Per **Owner Decision 6**, any P-DATA data-quality failure **immediately STOPS the affected cycle** — the whole cycle is rejected, not merely a single candidate:

| Failure | Detection | Result |
|---------|-----------|--------|
| Missing Price | null/absent mark or bar | **Reject Cycle → Alert → No Trade** |
| Invalid Volume | non-positive/implausible volume | **Reject Cycle → Alert → No Trade** |
| Duplicate Bar | repeated bar timestamp/idempotency key | **Reject Cycle → Alert → No Trade** |
| Stale Data | age > max threshold (OD-PDATA-7) | **Reject Cycle → Alert → No Trade** |
| Market Closed | outside the engine's session (NY calendar) | **No cycle / No Trade** |

- **Cycle-level rejection (Owner Decision 6):** detecting any of the above in the frame **aborts the entire affected cycle** — no scoring, no risk, no sizing, no execution occurs for that cycle. This is stricter and safer than per-candidate dropping: a compromised frame never produces trades.
- The rejection is **dead-lettered (B8 DLQ) + alerted** and recorded as a **`Recovery`/data-quality audit event** in `system_events` (existing `GatewayEvent`/`WorkerFailure`); **no fabricated data is ever substituted**.
- This gate is upstream of D3/D4 — **garbage never reaches scoring or risk**, and a single bad input cannot leak a partial cycle.

---

## 5. Scheduler Design

- P-ORCH runs as a **B8 `Scheduler` worker** (`TradingCycleWorker`) — reusing the existing synchronous scheduler with **per-worker failure isolation** (a failing cycle is recorded + dead-lettered; the scheduler survives).
- **Cadence (OD-PORCH-4):** Core (swing) on an EOD/daily cycle; Turbo (intraday) on a minute-level cycle — aligned to P-DATA's refresh and the **America/New_York** market session (D2 ratification). Market-closed cycles are no-ops (§4).
- **Explicit start (B9 OD-D6):** the trading worker is **registered** during bootstrap but the loop begins **only** on the operator's `application.start()` — never auto-starts. This gives the operator a chance to verify recovered state before autonomous trading begins.
- **One cycle at a time** per engine (no overlapping cycles); a cycle either completes or aborts cleanly (§6).

---

## 6. Failure Recovery Design

Per the project-wide model: **Fail-Safe + DLQ + manual resolution; no automatic retry.**

| Failure point | Response |
|---------------|----------|
| Pre-cycle/data-quality | Reject + alert + **No Trade**; cycle ends safely (§4). |
| D3/D4 raises | Cycle aborts for that candidate; **D4 fail-safe rejects on bad input** (existing); DLQ + alert. |
| Sizing invalid | No Trade for that candidate; audited. |
| Execution/D5 error | Order left in its true persisted state (D5 transitions are atomic via the DAL transaction); failed unit dead-lettered; **no duplicate** (D5 `DuplicateOrderProtection`). |
| Portfolio/perf step error | Domain rows already durable; portfolio is **recomputable from PostgreSQL** (next snapshot/restart); DLQ + alert. |
| PostgreSQL unreachable | Cycle halts (PostgreSQL is truth); B7/B9 fail-safe; no trading. |
| Redis unavailable | DEGRADED; marks supplied from the frame; correctness unaffected. |
| Partial cycle (e.g., crash after fill, before perf) | The **fill is durable**; portfolio/perf are derived and self-heal on the next snapshot/restart (recovery §7). **No money state is lost** because money state lives in `fills`/`positions`. |

P-ORCH **never auto-retries** a dead-lettered unit; the **next scheduled cycle** is normal cadence (not a retry). It never mutates domain rows to "fix" a failure.

---

## 7. Restart Recovery Design

Restart recovery is **mandatory (Owner Decision 4)** and runs before any cycle:

- **B9 recovery runs first (unchanged):** rebuild **portfolio state**, **open positions**, **pending orders** (`DuplicateOrderProtection` fingerprints), RiskState inputs, and the **kill-switch cache** **from PostgreSQL** (ratified order: Kill-Switch → Portfolio → Duplicate Protection → Risk State → Warm Redis).
- **Scheduler state restored:** the `TradingCycleWorker` and B8 workers are re-registered at bootstrap; the scheduler resumes via the **explicit operator `start()`** (B9 OD-D6) — the loop does not auto-resume before the operator confirms recovered state.
- **Resume safely without duplicate actions (Owner Decision 4):** P-ORCH holds **no durable cycle state**; it does **not** resume a half-finished cycle. It begins **fresh** cycles against the recovered, consistent domain state. Any partial effects of an interrupted cycle are **durable rows** (signals/orders/fills/positions); **in-flight orders** (`New`/`Sent`) keep their fingerprints blocked (B9 §8), so a replayed signal **cannot double-submit** and no action is duplicated.
- **Marks are cold** (P-DATA re-acquires from the provider); until refreshed, unrealized PnL excludes missing marks (D6 fail-safe).
- A **`Recovery` audit event** records what was restored (portfolio, positions, pending orders, scheduler, kill-switch level).
- Crash-restart ≡ graceful restart (PostgreSQL truth + cold Redis + idempotent recovery), per B9.

---

## 8. Audit Trail Design

Append-only, PostgreSQL-durable, **no new enum/table**. **Every stage produces an audit event (Owner Decision 5):**

| Stage | Audit record (existing sinks/members) |
|-------|----------------------------------------|
| **Scan** | candidate-generation summary → `system_events` `GatewayEvent` (counts, dropped, quality) |
| **Score** | durable `scores` rows (with `breakdown`) + `signals` |
| **Risk** | durable `risk_checks` rows (decision + gates) |
| **Sizing** | sizing outcome → `system_events` `GatewayEvent` (capital/allocation used, quantity, or No-Trade reason) |
| **Execution** | `audit_logs` via D5 `AuditEventFlow` (created/submitted/fill/filled/cancel/reject) |
| **Portfolio** | snapshot/stat outcome → `performance_records` (+ snapshot figures in `detail`) |
| **Recovery** | restart-recovery summary → `system_events` `GatewayEvent` (what was restored; see §7) |
| **Kill-Switch** | `system_events` `KillSwitchActivated`/`GatewayEvent` (level + gated stage + outcome) |

- **Cycle lifecycle** (start/stop, No-Trade, data-quality cycle-reject) → `system_events` (`GatewayEvent`/`WorkerFailure` with reason in `detail`).
- **DLQ** → `WorkerFailure` `system_events` (B8) for every rejected/failed unit.
- Every cycle is fully reconstructable from the durable record; secrets redacted (B8 logging). **No new enum or table** — all eight stage events reuse existing members/sinks.

---

## 9. Kill-Switch Behavior

P-ORCH **reads** the current kill-switch level (B8 `KillSwitchLevelCache.current_level()`; set only by D4/owner — P-ORCH **never decides or changes it**) and **modulates the loop**; the **trade-acceptance block at L2+ remains D4's `KillSwitchGate`** (no duplication, no risk-rule change):

| Level | Meaning | P-ORCH loop behavior | Enforcement |
|-------|---------|----------------------|-------------|
| NONE/L0 | normal | full pipeline | — |
| **L1** | Pause Scanner | **skip stages 1–3** (no new candidates) | P-ORCH loop gate (operational) |
| **L2** | Pause New Trades | candidates may score, but **D4 rejects all new trades** | **D4 `KillSwitchGate`** (existing) |
| **L3** | Pause Execution | accepted candidates are **not executed** (skip stages 5–7) | P-ORCH execution gate (superset of L2) |
| **L4** | Emergency Shutdown | **stop the loop**; graceful shutdown; no new cycles | P-ORCH halt + B9 shutdown |

- The **numeric block threshold (L2+) lives in D4 constants (unchanged)**; P-ORCH's L1/L3/L4 handling is operational loop control derived from the recorded level.
- Existing **open positions** are never force-closed by the kill switch here (consistent with `OWNER_PROFIT_POLICY`: exits governed by the approved methodology, not by P-ORCH); L4 stops *new activity* and shuts the loop.

**Highest-priority semantics (Owner Decision 3).** The kill-switch is evaluated **first, before any other gate**, every cycle. When activated (L2+):
- **No new positions** — sizing/execution stages are not entered for new candidates.
- **No new orders** — no order is created or submitted.
- **Existing state preserved** — open positions/orders are **never** force-modified or force-closed by the kill switch; the durable state is left intact.
- **Full audit event recorded** — a `Kill-Switch` audit event (`system_events`, existing `KillSwitchActivated`/`GatewayEvent`) captures the level, the stage gated, and the no-trade outcome.
The kill-switch **overrides all other stages**; no candidate, score, or recommendation can proceed past an active L2+ block.

---

## 10. Safety Controls (consolidated)

1. **Market-hours gate** — trade only during the engine's NY session; else No-Trade.
2. **Data-quality gate** — missing/invalid/duplicate/stale/closed → Reject → Alert → No Trade (§4).
3. **Kill-switch gating** — L1 scan-pause / L2 D4-block / L3 exec-pause / L4 shutdown (§9).
4. **Risk gate (D4, unchanged)** — max-open, max-trades/day, daily/weekly DD, consecutive-loss, sector-exposure, monthly pause — enforced per candidate.
5. **Duplicate protection (D5, unchanged)** — one live order per fingerprint; rebuilt on restart.
6. **Sizing safety** — quantity from current owner settings; 0/unaffordable/missing-mark → No Trade; never hardcoded.
7. **Fail-safe + DLQ** — any stage failure → no unsafe trade, dead-letter, alert, no auto-retry.
8. **PostgreSQL-truth halt** — DB unreachable → stop trading.
9. **Explicit start** — autonomous loop begins only on operator `start()`.
10. **Human-gated intelligence** — D14A produces recommendations only; **P-ORCH applies none** (req 8–11); no auto-tuning, no ML decisioning, no auto-parameter changes.

---

## 11. State Transitions

**Orchestration cycle state machine** (operational, transient — not persisted, not a new enum; module constants like B8's operational states):

```
IDLE → PRECHECK → ACQUIRING_DATA → SCANNING → SCORING → RISK_GATING
     → SIZING → EXECUTING → SETTLING(fills+portfolio) → REPORTING → IDLE

Halt states (from kill-switch/health, any stage):
   PAUSED_SCANNER (L1) · PAUSED_NEW_TRADES (L2, via D4) ·
   PAUSED_EXECUTION (L3) · HALTED (L4 / PostgreSQL down) · DEGRADED (Redis down)
```

- Transitions are **forward-only within a cycle**; any gate failure routes to **NO_TRADE → REPORTING → IDLE** (clean end), never to a partial unsafe state.
- **Per-trade state** remains the **D5 order/position state machine** (`New→Sent→Filled`, `Open→Closed`) — unchanged; P-ORCH never transitions orders/positions itself (it calls D5).
- The cycle state is in-memory only; restart begins at IDLE against B9-recovered domain state (§7).

---

## 12. Preserved D1–D14A Invariants

| Invariant | How P-ORCH preserves it |
|-----------|-------------------------|
| PostgreSQL sole source of truth | All decisions/outcomes persisted via the DAL; portfolio recomputable. |
| Redis non-authoritative | Only marks/kill-switch cache; correctness independent. |
| Score Engine authoritative | Stage 3 = D3 only; P-ORCH never scores. |
| Portfolio ⟂ Risk ⟂ Execution | D6 computes, D4 decides, D5 executes; P-ORCH only sequences. |
| No strategy/score/risk/execution/allocation modification | Calls existing engines + fixed sizing reading config; changes no rule. |
| No auto-tuning / ML / auto-parameter / auto-recommendation-apply | Stage 10 advisory only; human-gated (req 8–11). |
| Capital/allocation owner-controlled, off-hours editable | Sizing reads current settings; never mutates; honors change-window. |
| No new tables/enums/schema | Reuses existing tables + existing event members; cycle state transient. |
| No D1–D14A modification | Additive orchestrator at the integration layer. |
| Fail-safe; no auto-retry | Gate failures → No Trade + DLQ + manual. |

---

## 13. Dependencies

**P-ORCH depends on:** P-DATA (`MarketDataFrame`), D3 (`SelectionEngine`), D4 (`RiskDecisionEngine` + B9 `RiskStateBuilder`), `SizingPolicy`/P-SIZE (reads owner config), D11 (`ExecutionTarget`), D5 (`ExecutionEngine` via the target), D6 (`PortfolioState`), D14A (intelligence — advisory), B8 (`Scheduler`/`Worker`, DLQ, alerting, `KillSwitchLevelCache`, `system_events`), B9 (bootstrap/recovery, `Application`, explicit start).
**P-ORCH does not depend on:** any broker/IBKR, TradingView, or a UI.
**Wiring (OD-PORCH-1):** P-ORCH composes from the B9 `Application` (engines + DAL + ops) without modifying B9's audited files where possible; attaching the execution target into the cycle (closing D11 note N-1) is done at this layer. If a minimal B9 bootstrap extension is preferred, it is an additive, versioned change.

---

## 14. Owner Decisions Required

| # | Decision | Recommended |
|---|----------|-------------|
| **OD-PORCH-1** | P-ORCH wiring | Additive integration-layer component composed from the B9 `Application`; minimal bootstrap extension only if needed (versioned). |
| **OD-PORCH-2** | Sizing placement | Dedicated `SizingPolicy`/P-SIZE component reading owner config; invoked by P-ORCH. |
| **OD-PORCH-3** | Capital/allocation settings source + change-window | Config-sourced; editable outside market hours only (governance); P-ORCH reads effective values, never mutates. |
| **OD-PORCH-4** | Cycle cadence + market calendar | Core EOD / Turbo intraday on the NY session calendar; owner sets exact intervals. |
| **OD-PORCH-5** | Kill-switch L1/L3/L4 operational mapping | As designed (read level; modulate loop; D4 enforces L2+ block). |
| **OD-PORCH-6** | Missing-mark handling | No Trade for that instrument (data-quality block); never fabricate a price. |
| **OD-PORCH-7** | D14A trigger cadence | Per cycle or daily; recommendations only, human-gated; applies nothing. |

---

## 15. Definition of Done

1. **End-to-end orchestration** (stages 0–10) defined; P-ORCH calls only existing public methods; no domain logic added.
2. **Scheduler**: B8 `TradingCycleWorker`; per-cycle failure isolation; explicit operator start; market-hours/cadence aware.
3. **Position sizing**: reads current owner capital/allocation (never hardcoded); fixed allocation (V2-001); missing/invalid → No Trade.
4. **Data-quality blocking** (§4): missing price / invalid volume / duplicate bar / stale / market-closed → Reject → Alert → No Trade; upstream of D3/D4.
5. **Kill-switch behavior** (§9): L1 scan-pause / L2 D4-block / L3 exec-pause / L4 shutdown; P-ORCH reads, D4 enforces L2+, no rule change.
6. **Failure recovery** (§6) + **restart recovery** (§7): Fail-Safe + DLQ + manual; B9 rebuilds; crash ≡ graceful; no auto-retry; money state in `fills`/`positions`.
7. **Audit trail** (§8): orders→`audit_logs`; cycle/gates/DLQ→`system_events`; decisions→D1 rows; performance→`performance_records`; no new enum/table.
8. **State transitions** (§11): transient cycle state machine + halt states; per-trade state remains D5's.
9. **Safety controls** (§10) all present; **D14A human-gated**; no auto-tuning/ML/auto-parameter changes.
10. **Invariants preserved** (§12); capital/allocation owner-controlled, off-hours editable; no D1–D14A modification.
11. Owner decisions OD-PORCH-1…7 **and ratified Owner Decisions 1–11 (§0)** honored: sole conductor; no-bypass ordered chain; kill-switch highest priority; mandatory restart recovery; per-stage audit; cycle-level data-quality rejection; authoritative owner capital settings (read-only, off-hours editable); D14A advisory-only; profit policy unchanged.
12. With P-DATA + P-ORCH + sizing + deployment, the **first autonomous paper-trading run** is executable (`EXECUTION_TARGET=paper`).
13. **Mandatory validation coverage (Owner Decision 11)** — the future build must validate:
    - **Full autonomous paper-trading loop** — an end-to-end cycle (data → … → portfolio → performance) with the paper target.
    - **Recovery validation** — restart restores portfolio/open-positions/pending-orders/scheduler; resumes with **no duplicate actions**.
    - **Kill-switch validation** — L1 scan-pause, L2 D4-block, L3 exec-pause, L4 shutdown; existing state preserved; audit recorded.
    - **Audit validation** — every stage (Scan/Score/Risk/Sizing/Execution/Portfolio/Recovery/Kill-Switch) emits a durable, reconstructable record.
    - **Failure-path validation** — data-quality cycle-reject, stage failures → DLQ + No-Trade, PostgreSQL-down halt, no auto-retry.
    - **Scheduler validation** — explicit start; cadence/market-hours gating; per-cycle failure isolation; no overlapping cycles.
14. `P-ORCH_BUILD_REPORT.md` produced at the future build gate; this document stops at architecture.

---

## 16. Consistency Review (no conflicts / no hidden changes)

Verified against each frozen phase and governance policy. **Result: no conflicts; no hidden strategy/risk/execution/sizing/allocation changes; no auto-tuning path.**

| Reviewed against | P-ORCH interaction | Conflict / hidden change? |
|------------------|--------------------|---------------------------|
| **D1** (models/enums/schema) | Uses existing entities; cycle state is transient | **None** — no new table/enum/schema |
| **D2** (DAL) | Reads/writes via the existing DAL + structural lookups | **None** — D2 unmodified |
| **D3** (scoring) | Calls `SelectionEngine.run`; consumes `ScoredCandidate` | **None** — scoring unchanged; P-ORCH never scores |
| **D4** (risk) | Calls `RiskDecisionEngine.evaluate` with `RiskStateBuilder` inputs; L2+ block is D4's gate | **None** — thresholds/gates/ordering unchanged; P-ORCH never decides risk |
| **D5** (execution) | Paper target delegates to `ExecutionEngine` (create→submit→fill) | **None** — state machines/validation/dup-protection unchanged |
| **D6** (portfolio) | `open/close` + `snapshot(marks)`; `persist_stats` | **None** — PnL/equity/HWM/drawdown formulas unchanged |
| **B7/B8/B9** | Reuses persistence, scheduler/DLQ/alerting/kill-switch, bootstrap/recovery | **None** — additive; prior files unmodified |
| **D11** (targets) | Uses `ExecutionTarget` (signals/paper only) | **None** — IBKR/TradingView not invoked |
| **D14** (validation) | Feeds it; thresholds are **eligibility gates measured post-run**, not P-ORCH trade rules | **None** — P-ORCH does not enforce validation thresholds as trading rules |
| **D14A** (intelligence) | Triggers reporting; **applies nothing** | **None** — advisory only; no feedback loop; no auto-tuning/ML |
| **P-DATA** | Consumes `MarketDataFrame`; cycle-level data-quality gate; transient marks | **None** — aligned; data-quality rejection consistent |
| **Owner Validation Policy** | Paper 85%/PF2.0/DD10; Live 95%/PF3.0/DD5; 30d/200 trades/2+ regimes/long&short | **None** — recorded as post-run eligibility gates; not enforced as trade logic |
| **Owner Profit Policy** | No fixed profit target; winners run; exits authoritative; profit % reporting only | **None** — P-ORCH has **no profit-target exit logic**; L4 never force-closes; exits remain D5/strategy |
| **Capital Allocation Policy** (`B9_OWNER_POLICY_UPDATE`) | Sizing reads current owner capital/allocation; off-hours editable; forward-only | **None** — no hardcoded values; no auto capital change |

**Sizing — explicit honesty note (the one place new behavior appears):** the `SizingPolicy` step **implements** the *already-approved* **fixed-allocation methodology** for the first time (previously a gap where quantity was externally supplied). It is **not** a policy change: `quantity = floor(allocation_fraction × owner_capital ÷ mark)`, where `allocation_fraction` and `capital` are **owner-configured** (read current, never hardcoded), the base is the **owner-defined capital (non-compounding**, per the profit-governance decision — not growing equity), and it introduces **no risk-based sizing** (V2-001 intact). This is flagged for explicit confirmation at the build audit.

**Auto-tuning / ML scan:** no recommendation, score, threshold, or parameter is ever auto-applied; D14A output is advisory and human-gated; there is no learning loop, no parameter mutation, and no ML decisioning anywhere in P-ORCH.

---

## 17. Dependency Map

```
                         ┌───────────────────────────────────────────┐
                         │            P-ORCH (conductor)              │
                         │  sole autonomous trading loop · no bypass  │
                         └───┬───────┬───────┬───────┬───────┬────────┘
        consumes             │ calls │ calls │ calls │ calls │ triggers
        ▼                    ▼       ▼       ▼       ▼       ▼
 ┌─────────────┐      ┌──────────┐ ┌─────┐ ┌──────┐ ┌──────────┐ ┌───────┐
 │   P-DATA    │      │ D3 Score │ │ D4  │ │SIZING│ │ D11      │ │ D14A  │
 │ MarketData  │      │ Engine   │ │Risk │ │Policy│ │ Exec     │ │ Intel │
 │ Frame       │      └────┬─────┘ └──┬──┘ └──┬───┘ │ Target   │ │(advis)│
 └──────┬──────┘           │          │       │     └────┬─────┘ └───────┘
        │ marks/facts       │          │       │          │ paper→
        │                   │          │  reads owner     ▼
        │                   │          │  capital/alloc  D5 ExecutionEngine
        │                   │          │  (config)        │ create/submit/fill
        ▼                   ▼          ▼                   ▼
 ┌────────────────────────────────────────────────────────────────────┐
 │ B9 Application (single PostgresDataAccessLayer)  +  B8 Operations    │
 │  DAL · Scheduler/Worker · DLQ · AlertManager · KillSwitchLevelCache  │
 └───────────────┬──────────────────────────────────┬──────────────────┘
                 ▼ truth                              ▼ cache (non-auth)
          ┌────────────┐                        ┌──────────┐
          │ PostgreSQL │  signals/scores/orders │  Redis   │ marks, ks-level
          │ (19 tables)│  fills/positions/perf  │          │
          └────────────┘  market_snapshots/audit└──────────┘
                 ▲ rebuild on restart (B9 recovery) → D6 PortfolioState etc.
```

P-ORCH depends **downward** on every layer and is depended on by **none**; no cycle. D6 computes ⟂ D4 decides ⟂ D5 executes; P-ORCH only sequences.

---

## 18. State-Transition Diagram (cycle)

```
        ┌──────┐  start() (explicit, B9 OD-D6)
        │ IDLE │◄───────────────────────────────────────────────┐
        └──┬───┘                                                 │
           ▼                                                     │
      ┌──────────┐  kill-switch L4 / PostgreSQL down             │
      │ PRECHECK │──────────────► HALTED ──► (graceful shutdown) │
      └──┬───────┘  market closed / L1 ──► PAUSED_* ──► IDLE ────┤
         ▼ ok                                                    │
   ┌───────────────┐ data-quality fail (req 14) ──► NO_TRADE ────┤
   │ ACQUIRING_DATA│───────────────────────────────────────────►│
   └──┬────────────┘                                             │
      ▼                                                          │
   ┌─────────┐   ┌─────────┐   ┌────────────┐  L2+ block (D4) ──►│ NO_TRADE
   │ SCANNING│──►│ SCORING │──►│ RISK_GATING│───────────────────►│
   └─────────┘   └─────────┘   └────┬───────┘                    │
                                    ▼ accepted                   │
                              ┌─────────┐ qty≤0/no mark ─────────►│ NO_TRADE
                              │ SIZING  │                         │
                              └────┬────┘                         │
                                   ▼   L3 exec-pause ────────────►│ PAUSED_EXECUTION
                              ┌───────────┐                       │
                              │ EXECUTING │ (D11→D5)              │
                              └────┬──────┘                       │
                                   ▼                              │
                         ┌──────────────────┐                    │
                         │ SETTLING (fills, │                    │
                         │  portfolio D6)   │                    │
                         └────┬─────────────┘                    │
                              ▼                                   │
                        ┌───────────┐                            │
                        │ REPORTING │ (perf + D14A advisory) ─────┘
                        └───────────┘
```

Forward-only within a cycle; any gate routes cleanly to `NO_TRADE → REPORTING → IDLE`. Per-trade state remains **D5's** `New→Sent→Filled` / `Open→Closed` (unchanged).

---

## 19. Failure-Path Diagram

```
  any stage
     │
     ├─ data-quality fail (missing/invalid/dup/stale/closed)
     │      → REJECT CYCLE → Alert → DLQ(WorkerFailure) → NO_TRADE → IDLE
     │
     ├─ D3/D4 raises / bad input
     │      → D4 fail-safe REJECT → Alert → DLQ → next candidate / NO_TRADE
     │
     ├─ sizing invalid (qty≤0 / no mark / unaffordable)
     │      → NO_TRADE (this candidate) → audit → continue
     │
     ├─ execution/D5 error
     │      → order left in true persisted state (atomic txn) → DLQ → Alert
     │        (DuplicateOrderProtection prevents re-submit)
     │
     ├─ portfolio/perf step error
     │      → domain rows already durable → recompute on next snapshot/restart → DLQ
     │
     ├─ Redis down
     │      → DEGRADED → marks from frame → continue (correctness unaffected)
     │
     └─ PostgreSQL unreachable
            → HALT (PostgreSQL is truth) → no trading → Alert

  Invariants: NO auto-retry · NO unsafe partial trade · NO fabricated data ·
              NO domain-row mutation to "fix" · money state lives in fills/positions
```

---

## 20. Recovery Flow (restart — mandatory, Owner Decision 4)

```
 process start
     │
     ▼
 [B7] ConnectionPool health-check ── PG unreachable → ABORT (PersistenceError)
     │ ok
     ▼
 [B9 recovery, read-only, ratified order]
     1 Kill-Switch cache  ◄─ latest KillSwitchActivated (system_events)
     2 Portfolio state    ◄─ closed→open positions replay (D6 methods)
     3 Pending orders     ◄─ New/Sent orders → DuplicateOrderProtection.register
     4 Risk-state inputs  ◄─ counts/figures (read-only)
     5 Warm Redis         ◄─ from PostgreSQL (skipped if Redis down)
     │
     ▼
 [Scheduler state restored] re-register TradingCycleWorker + B8 workers
     │
     ▼
 [Recovery audit event] records {portfolio, positions, pending_orders,
                                 scheduler, kill_switch_level}
     │
     ▼
 await explicit operator start() ──► begin FRESH cycles (no half-cycle resume)
     │
     ▼
 resume safely: in-flight fingerprints blocked ⇒ NO duplicate actions
                marks cold ⇒ refreshed by P-DATA; missing marks excluded (D6)
```

Crash-restart ≡ graceful restart (PostgreSQL truth + cold Redis + idempotent, read-only recovery).

---

## 21. Kill-Switch Flow (highest priority, Owner Decision 3)

```
 every cycle: read level (B8 KillSwitchLevelCache.current_level)  ── evaluated FIRST
     │
     ├─ NONE/L0 → full pipeline
     ├─ L1  → PAUSE SCANNER     : skip Scan/Score/Risk (no new candidates)
     ├─ L2  → PAUSE NEW TRADES  : D4 KillSwitchGate REJECTS all new trades
     ├─ L3  → PAUSE EXECUTION   : skip Sizing/Execution (accepted ≠ executed)
     └─ L4  → EMERGENCY SHUTDOWN: stop loop → graceful shutdown
 on any active block (L2+):
     • NO new positions   • NO new orders   • existing state PRESERVED (never force-closed)
     • FULL audit event recorded (KillSwitchActivated/GatewayEvent: level+stage+outcome)
 ownership: level SET only by D4/owner (B8 records). P-ORCH READS and modulates;
            the L2+ numeric threshold lives in D4 constants (UNCHANGED).
```

---

## 22. Scheduler Flow

```
 bootstrap → register TradingCycleWorker (+ B8 ops workers) → DO NOT auto-start
     │
     ▼  operator application.start()  (B9 OD-D6, explicit)
 ┌──────────────────────────────────────────────────────────────┐
 │ B8 Scheduler loop (synchronous; per-worker failure isolation)  │
 │   tick → is it this engine's session? (NY calendar, D2)        │
 │           Core: EOD/daily · Turbo: intraday/minute             │
 │     yes → run ONE TradingCycle (state machine §18)             │
 │            failure → record WorkerFailure + DLQ; loop survives  │
 │     no  → no-op (market closed)                                 │
 │   one cycle at a time per engine (no overlap)                   │
 └──────────────────────────────────────────────────────────────┘
     │ stop() → finish current tick → ServiceStopped → close pool (B9 shutdown)
```

---

## 23. Remaining Implementation Phases After P-ORCH

To reach (and progress beyond) the first autonomous paper-trading run, in order:

| Phase | Purpose | Gate |
|-------|---------|------|
| **P-SIZE** (small; may be folded into P-ORCH build) | Implement the fixed-allocation `SizingPolicy` reading owner capital/allocation config (no risk-based sizing) | OD-PORCH-2/3 |
| **P-DEPLOY** | Provision PostgreSQL + Redis; run `db/apply_schema.py`; create current-month partitions; set env (`DATABASE_URL`, `STARTING_CAPITAL`, `EXECUTION_TARGET=paper`, capital/allocation) + secrets | ops |
| **P-DATA build** | Implement the approved market-data/mark provider (Mock/Replay first) + FactsBuilder + B8 refresh worker | P-DATA approved ✓ |
| **P-ORCH build** | Implement this orchestrator + the 6 mandated validations (§15.13) | this doc |
| **First autonomous paper run** | Run `EXECUTION_TARGET=paper` end-to-end | — |
| **D14 build** | Implement paper-validation reporting/gates to measure the run vs the Owner Validation Policy (85%/PF2.0/DD10) | D14 approved ✓ |
| **30-day / 200-trade validation period** | Accumulate data; evaluate against paper-PASS thresholds | Owner Validation Policy |
| **D14A build** | Implement trade-intelligence reporting (advisory only) | D14A approved ✓ |
| **D13 IBKR** (future, owner-gated) | Implement live broker target — only after a PASS paper period + Live thresholds (95%/PF3.0/DD5) + versioned approval | D11 OD-8 / D13 |
| **Live go-live** | Enable `IBKR_MODE=live` under governance | Owner |

**Minimum to run the first paper session:** P-SIZE + P-DEPLOY + P-DATA build + P-ORCH build. **To validate it for live eligibility:** + D14 build + the 30-day/200-trade period.

---

## 24. Stop Gate (requirement 15)

**STOP.**

Final architecture — **architecture only**: no code, no implementation, no tests, no source/schema changes, no modification to D1–D14A, **no auto-tuning, no ML decisioning, no automatic parameter changes**, and **D14A recommendations remain human-gated**. The consistency review (§16) found **no conflicts and no hidden strategy/risk/execution/sizing/allocation changes**; the single new behavior (fixed-allocation sizing) **implements** the already-approved policy and is flagged for build-audit confirmation. Await owner review and rulings on **OD-PORCH-1…OD-PORCH-7**. Once approved and built (with P-SIZE, P-DEPLOY, and the P-DATA build), this completes the path to the **first autonomous paper-trading run**, which then feeds the D14 validation gates before any live (D13) eligibility.
