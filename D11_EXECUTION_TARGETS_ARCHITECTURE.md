# D11_EXECUTION_TARGETS_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No tests. No source changes. No schema changes.**
**Derived from:** `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` · approved B1–B9 artifacts · `D10_TRADINGVIEW_INTEGRATION_ARCHITECTURE.md` · `B9_OWNER_POLICY_UPDATE.md` · `THUL_NURAYN_FINAL_REVIEW.md`.
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** D11 — Execution-target abstraction (Signals / TradingView / Paper / Interactive Brokers).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · **Portfolio ⟂ Risk ⟂ Execution** intact · D3 **Score Engine = single source of truth** · all approved **strategy / risk / execution / capital-recovery / position-allocation** logic **unchanged** · **no broker implementation** · **no API/UI implementation** · no new tables · no new enums · no schema changes · **no modifications to D1–D10** · TradingView and Interactive Brokers both **optional** · no TradingView dependency in the core.

---

## 1. Purpose

D11 defines a single, future-proof **execution-target abstraction**: the seam that decides *what happens to a risk-accepted candidate* — emit a signal, distribute it, simulate a fill, or (future) route it to a real broker — **without changing any domain logic**.

It introduces **one new contract** (`ExecutionTarget`) and a **mode-selection** mechanism at the integration layer (B9/composition). Every existing phase (D1–D10) is reused unchanged: D3 still scores, D4 still decides, D5 still runs the order/position state machines, D6 still computes portfolio figures, B7 still persists, B8 still operates, B9 still wires.

D11 contains **no broker code, no API, no UI, and no implementation** — it is the contract + composition design only.

---

## 2. Scope

**In scope (architecture only):**
- An `ExecutionTarget` abstraction layer above the D5 execution boundary.
- Interface contracts for four targets: **Signals Only**, **TradingView (distribution)**, **Paper Trading**, **Interactive Brokers (future)**.
- Mode-selection architecture (config-driven; one active target per process).
- Per-mode startup, failure handling, audit, and security requirements.
- Subscription compatibility, multi-broker compatibility, and the Signals → Paper → IBKR migration path.

**Out of scope (explicitly):**
- Any broker connectivity / IBKR client / network code (requirements 23, 9, D).
- Any API / FastAPI / webhook server / UI (requirements 24, 25). *(The D10 webhook is a separate, already-specified concern; D11 does not add surfaces.)*
- Any new SQL table, column, enum, or schema change (requirements 26, 27, 28).
- Any modification to D1–D10, or to approved strategy/risk/execution/capital-recovery/allocation logic (requirements 1, 5–9).
- Position sizing changes (V2-001).

---

## 3. Preserved Invariants (requirements 1–9)

| # | Invariant | How D11 preserves it |
|---|-----------|----------------------|
| 1 | All D1–D10 invariants | D11 is a new composition seam; it imports and orchestrates existing phases, modifying none. |
| 2 | PostgreSQL sole source of truth | All targets persist via the existing DAL; orders/positions/fills live in the existing tables; audit in `audit_logs`/`system_events`. |
| 3 | Redis non-authoritative | No target relies on Redis for correctness; caches remain advisory. |
| 4 | Portfolio ⟂ Risk ⟂ Execution | The target acts **only after** D4 accepts; D6 still computes, D4 still decides, D5 still executes. The target never decides risk or computes portfolio figures. |
| 5 | Approved strategy logic | D3 Score Engine scores all candidates regardless of target; targets never score. |
| 6 | Approved risk logic | D4 gates every candidate before any target acts; targets never gate. |
| 7 | Approved execution logic | Execution targets (Paper/IBKR) delegate to the **existing** D5 `ExecutionEngine` + `BrokerSyncContract`; no state-machine/validation logic is reimplemented. |
| 8 | Approved capital-recovery logic | The B9/D6 rebuild (capital = starting_capital + Σ realized PnL) is unchanged; paper and live use the same recovery path. |
| 9 | Approved position-allocation methodology | Fixed-allocation methodology (10%/trade; V2-001) is unchanged; no target alters sizing. |

---

## 4. The Four Execution Targets

### A) Signals Only Mode
- **Behavior:** D3 scores → D4 gates → on accept, a **`Signal` (and optional alert/notification)** is recorded. **No order is created. No broker. No execution.**
- **Pipeline stop point:** at the signal/notification stage (no D5 order lifecycle).
- **External deps:** none. This is the **default and safest** target.

### B) TradingView Mode (signal distribution — outbound)
- **Behavior:** like Signals Only, plus the accepted signal is **distributed outward to TradingView** (or another notification channel) as an alert. **TradingView acts only as a distribution layer.**
- **No strategy logic in TradingView**; THUL-NURAYN remains authoritative for everything. **No order, no broker, no execution.**
- **Direction note:** this is **outbound** (THUL-NURAYN → TradingView), the *opposite* of D10 (TradingView → THUL-NURAYN as inbound signal *source*). The two are independent and either may be enabled without the other. **TradingView is optional and never a core dependency** (requirements 20, 21).

### C) Paper Trading Mode (simulated execution)
- **Behavior:** D3 → D4 → on accept, the candidate goes through the **existing D5 `ExecutionEngine`** with a **paper `BrokerSyncContract`** that **simulates** order acknowledgement and fills **in-memory/DB only**. Orders/positions/fills are persisted in the existing tables (real rows), distinguished as paper by a `broker_ref` convention (§9) and the audited active mode.
- **No real broker connectivity, no network.** This validates the full execution wiring without capital risk.

### D) Interactive Brokers Mode (future — definition only)
- **Behavior (future):** a concrete `BrokerSyncContract` adapter routes accepted orders to Interactive Brokers and reconciles via the existing D5 `SyncReconciliation`.
- **This document defines the contract and placement only.** **No implementation, no connectivity, no client.** IBKR is **optional** (requirement 22) and an owner-gated future phase (requirement D, 9).

---

## 5. Execution-Target Abstraction Layer (requirement 10)

A new **`ExecutionTarget`** seam sits at the integration layer (composition, above D5), selected at bootstrap:

```
  D3 Score → D4 Risk (decide)             [UNCHANGED CORE]
                 │ accepted candidate
                 ▼
        ┌─────────────────────────┐
        │   ExecutionTarget (D11)  │   one active per process (config-selected)
        ├─────────────────────────┤
        │ SignalsOnlyTarget   ─────┼─► record Signal / notify        (no order)
        │ TradingViewTarget   ─────┼─► record Signal + distribute    (no order)
        │ PaperTarget         ─────┼─► D5 ExecutionEngine + Paper BrokerSyncContract
        │ IBKRTarget (future) ─────┼─► D5 ExecutionEngine + IBKR  BrokerSyncContract
        └─────────────────────────┘
                 │ (execution targets only)
                 ▼
        D5 Execution → Fill → D6 Portfolio    [UNCHANGED CORE]
```

**Placement decision:** the abstraction lives in the **integration layer** (planned `src/app/targets/`, alongside B9 bootstrap) — it is composition/wiring, **not** a domain change and **not** a modification to D5. Execution targets *reuse* D5; non-execution targets simply stop before D5.

**Non-duplication guarantee:** Paper and IBKR targets do **not** reimplement order/position state machines, validation, duplicate protection, or reconciliation — they supply a `BrokerSyncContract` to the **existing** `ExecutionEngine`. The only genuinely new code (future) is the paper fill *simulator* and the IBKR *adapter* behind the existing ABC.

---

## 6. Execution-Target Interface Contracts (requirement 11)

**`ExecutionTarget` (new ABC, architecture-level):**

| Member | Purpose |
|--------|---------|
| `name() -> str` | Mode label (`"signals" \| "tradingview" \| "paper" \| "ibkr"`) — a config string, **not** a new D1 enum. |
| `executes() -> bool` | Whether the target creates orders / touches a broker (False for Signals/TradingView; True for Paper/IBKR). |
| `startup_check() -> HealthLike` | Mode-specific readiness (no-op for Signals; channel check for TradingView; in-memory ok for Paper; connectivity check for IBKR-future). |
| `handle_accepted(candidate) -> outcome` | The **single entry** the pipeline calls after D4 accept. Non-execution targets record a Signal/alert; execution targets delegate to the existing D5 `ExecutionEngine`. |
| `shutdown()` | Graceful teardown (close channels/adapters; Paper/Signals are no-ops). |

**Relationship to existing contracts:**
- Execution targets **own a `BrokerSyncContract`** (existing D5 ABC) and an `ExecutionEngine` (existing D5). The **paper** and **IBKR** implementations are `BrokerSyncContract` subclasses (the existing seam B9 already uses for `MockBrokerSyncContract`).
- The `ExecutionTarget` is therefore a thin policy wrapper: *decide whether to execute, and if so, drive D5*. No execution rule is added.

---

## 7. Mode-Selection Architecture (requirement 12)

- **Source:** a single configuration value, `EXECUTION_TARGET` (env/config), resolved at **B9 bootstrap**. Values map to a target factory. **No new D1 enum** — this is a config string mapped to a target (the same pattern B8 used for operational-state strings and D10 used for mode mapping).
- **Cardinality:** exactly **one active target per process**. Multi-broker routing is a future capability (§13/§18), not a v-now behavior.
- **Default:** **Signals Only** (safest; zero external dependencies) — see Owner Decision OD-1.
- **Resolution point:** the target is constructed in `build_application`/`bootstrap` and injected into the pipeline entry, exactly where B9 already wires `ExecutionEngine` and the mock broker. The core (D1–D9) never reads the mode.
- **Subscription gating:** mode selection is validated against the account's subscription entitlement (§9/§17) — the process refuses to start in a target the subscription does not permit.

---

## 8. Startup Behavior Per Mode (requirement 13)

Common precondition (all modes): **PostgreSQL reachable** (B7 health check; B9 health-gated startup) or the process aborts. Redis down ⇒ DEGRADED. Scheduler still starts explicitly (B9 D6).

| Mode | Startup behavior |
|------|------------------|
| **Signals Only** | No broker, no channel. Target `startup_check` is a no-op. Emits `ServiceStarted`. |
| **TradingView** | If outbound distribution is enabled, verify channel config/credentials (env). Channel **failure is non-fatal** (alerts degrade; signals still recorded). Records a `GatewayEvent` for channel up/down. |
| **Paper** | Construct the paper `BrokerSyncContract` (always "connected"; in-memory simulation). No network. Emits `ServiceStarted`. |
| **IBKR (future)** | *(definition only)* Would perform a broker connectivity/health check and, on success, emit `IBGatewayReconnected`/`GatewayEvent`; failure handling per §9. **No implementation now.** |

---

## 9. Failure Handling Per Mode (requirement 14)

All failures are **non-destructive**, recorded durably (audit), surfaced via B8 alerting, and **never auto-retried** (manual DLQ resolution — consistent with B5/B7/B8/B9).

| Mode | Failure | Response |
|------|---------|----------|
| **All** | PostgreSQL unreachable | Abort (startup) / propagate to Fail-Safe (runtime); affected unit dead-lettered |
| **Signals Only** | Signal persistence error | DLQ; alert; no order ever attempted |
| **TradingView** | Outbound distribution error | **Non-fatal**; signal already recorded durably; DLQ for the distribution unit; no auto-retry |
| **Paper** | Simulated execution/fill error | DLQ; alert; **no real money** affected; pipeline continues |
| **IBKR (future)** | Broker disconnect / order drift | Existing D5 `SyncReconciliation` Fail-Safe (DISCONNECTED/DRIFT); DLQ; manual reconciliation; no auto-retry |

Paper/live differentiation of failures is by the audited active mode and the `broker_ref` convention (below).

**Paper vs live row differentiation (no schema change):** orders/positions/fills persist in the **same existing tables**. Paper rows carry a `broker_ref` prefix convention (e.g., `paper:…`) and the active mode is recorded in the audit `detail`; live/IBKR rows carry `ibkr:…`. No new column or enum is introduced (see Owner Decision OD-5).

---

## 10. Audit Trail Requirements (requirement 15)

- **Order lifecycle:** unchanged — D5 `AuditEventFlow` writes `audit_logs` (`Order` events) for create/submit/fill/cancel/reject, regardless of target.
- **Target/mode lifecycle:** recorded as `system_events` with existing members — `ServiceStarted/Stopped` (mode active/inactive), `GatewayEvent` (TradingView channel + future broker gateway events), `IBGatewayReconnected` (future IBKR), `WorkerFailure` (DLQ) — with the active mode and `broker_ref` convention in the JSONB `detail`. **No new enum/table** (mirrors the B8 DLQ-on-`system_events` and D10 `GatewayEvent` precedents).
- **Every accepted candidate** records which target handled it and the outcome, giving a complete, append-only, mode-aware audit without schema change.
- **Historical immutability** (governance policy): switching targets never recalculates past positions/PnL/audit/performance/recovery records.

---

## 11. Security Requirements (requirement 16)

| Concern | Requirement |
|---------|-------------|
| Credentials | TradingView distribution + (future) IBKR credentials live in **environment / secret manager only** — never in code, git, or logs (consistent with B7/B8/D10). |
| Redaction | All secrets redacted at the B8 logging boundary. |
| Paper | No credentials (in-memory simulation). |
| Transport | Outbound channels use TLS/authenticated endpoints; (future) IBKR uses its secured gateway. |
| Least privilege | The execution target can create orders only in execution modes the subscription permits; it cannot change risk/strategy config. |
| Mode integrity | The active mode is set only via trusted config/governance, not via inbound network input. |

---

## 12. Subscription Compatibility (requirement 17)

- Each target maps to a **subscription capability**: e.g., *Signals* tier → Signals/TradingView only; *Paper* tier → + Paper; *Live* tier → + IBKR.
- At bootstrap, the requested `EXECUTION_TARGET` is validated against the account's **subscription entitlement** (a config/governance input now; a full subscription system is future). If the target exceeds entitlement, **the process refuses to start** (fail-closed).
- Entitlement changes follow the **governance model** (analogous to `B9_OWNER_POLICY_UPDATE`): changes are forward-only and do not recalculate history. (See Owner Decision OD-6.)
- No subscription **UI/API** is designed here (requirements 24, 25) — entitlement is a configuration/governance input.

---

## 13. Future Multi-Broker Compatibility (requirement 18)

- The `BrokerSyncContract` ABC is **broker-agnostic**; multiple adapters (IBKR, others) can coexist as implementations.
- **v-now:** exactly **one active target/broker per process** (§7).
- **Future:** a routing layer could select among multiple brokers per order (by instrument/market/account). The `ExecutionTarget` seam is designed so this is an additive future capability — a new routing target composing multiple `BrokerSyncContract`s — **without** changing D5 or the schema. (See Owner Decision OD-7.)

---

## 14. Migration Path: Signals → Paper → IBKR (requirement 19)

A safe, owner-gated progression — **config/mode change only**, no data migration (schema is identical across all modes):

1. **Signals Only** (default) — validate the full Score→Risk pipeline and signal/audit recording with zero execution risk.
2. **(optional) TradingView** — add outbound distribution; still no execution.
3. **Paper Trading** — enable the paper target; validate the **full D5 execution + D6 portfolio + B9 recovery** path end-to-end with simulated fills (real DB rows, `paper:` `broker_ref`).
4. **Interactive Brokers (future)** — replace the paper `BrokerSyncContract` with the IBKR adapter; same tables, same recovery, `ibkr:` `broker_ref`; owner-gated, versioned approval, after a successful paper period.

**Properties of the path:**
- **Reversible & forward-only:** a mode change affects future trades only; historical records are never recalculated (governance policy).
- **No schema migration:** orders/positions/fills/audit tables are identical in every mode; only the active target and `broker_ref` convention differ.
- **Recovery-consistent:** B9 rebuilds (portfolio, duplicate protection, risk inputs, kill-switch) work identically in every mode because they read the same tables.
- **Each step is an explicit owner approval gate.**

---

## 15. Core Independence (requirements 20, 21, 22)

- **No TradingView dependency in the core:** D1–D9 never import TradingView; the TradingView target (outbound) and the D10 ingestion (inbound) are both optional plug-ins at the integration layer.
- **TradingView optional:** the default (Signals Only) and Paper/IBKR modes function with TradingView entirely absent.
- **Interactive Brokers optional:** IBKR is a future, owner-gated adapter; the system runs fully (Signals/TradingView/Paper) without it. The default target has **zero external dependencies**.

---

## 16. What D11 Does NOT Introduce (requirements 23–28)

- **No broker implementation** — only the contract + placement (IBKR is definition-only).
- **No API implementation** — no server/endpoint is added by D11.
- **No UI implementation.**
- **No schema changes / no new tables / no new enums** — reuses `orders`/`positions`/`fills`/`signals`, existing enums, and `system_events`/`audit_logs` with existing members + a `broker_ref` string convention.
- **No modification to D1–D10.**

---

## 17. Dependencies

**D11 depends on:** D1 (models/enums), D2 (DAL), D3 (scoring — authoritative), D4 (risk — decides), D5 (`ExecutionEngine`, `BrokerSyncContract`, `SyncReconciliation`), D6 (portfolio), B8 (audit/alerting/DLQ), B9 (bootstrap/composition + the existing `MockBrokerSyncContract`, which the Paper target generalizes).
**D11 does not depend on:** any concrete broker, IBKR client, TradingView (core), API, or UI.
**Future, owner-gated, additive deps:** an outbound notification client (TradingView mode) and an IBKR client (IBKR mode) — neither introduced now.

---

## 18. Definition of Done (architecture acceptance)

1. `ExecutionTarget` abstraction defined at the integration layer (one active per process).
2. Four targets specified: Signals Only (default), TradingView (outbound distribution), Paper (simulated via existing D5 + paper `BrokerSyncContract`), IBKR (definition only).
3. Interface contract (`name/executes/startup_check/handle_accepted/shutdown`) specified; execution targets delegate to existing D5 (no logic duplication).
4. Mode selection via config (`EXECUTION_TARGET`), no new enum; default Signals Only; subscription-gated.
5. Per-mode startup, failure handling, audit, and security specified.
6. Subscription compatibility, multi-broker future compatibility, and Signals→Paper→IBKR migration path specified.
7. Invariants preserved (PostgreSQL truth, Redis non-authoritative, Portfolio ⟂ Risk ⟂ Execution, strategy/risk/execution/capital-recovery/allocation unchanged).
8. No broker/API/UI/schema/table/enum introduced; no D1–D10 modification.
9. Owner decisions enumerated (see `D11_OWNER_DECISIONS.md`).
10. `D11_EXECUTION_TARGETS_ARCHITECTURE.md` + `D11_OWNER_DECISIONS.md` produced; stop at the D11 gate.

---

## 19. Stop Gate (requirement 32)

**STOP.**

This document is **architecture only** — no code, no tests, no source changes, no schema changes, no modifications to D1–D10. Implementation is forbidden until owner approval.

Owner decisions requiring approval are enumerated in **`D11_OWNER_DECISIONS.md`** with recommendations (not implemented). Await owner review and rulings before any D11 implementation begins.
