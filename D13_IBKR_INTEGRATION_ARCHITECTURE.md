# D13_IBKR_INTEGRATION_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No implementation. No tests. No connectivity. No source changes.**
**Derived from:** approved B1–B9 artifacts · `D11_EXECUTION_TARGETS_ARCHITECTURE.md` (+ `OD-8` IBKR definition-only) · `D11_BUILD_REPORT.md`/`D11_AUDIT.md` · `D12_TRADINGVIEW_OUTBOUND_ARCHITECTURE.md` · `B9_INTEGRATION_ARCHITECTURE.md` · `B8_OPERATIONS_ARCHITECTURE.md` · `B5_EXECUTION_ARCHITECTURE.md`.
**Status:** Architecture only — **definition-only** per D11 OD-8; implementation is a **future owner-gated phase after a successful Paper period**.
**Phase:** D13 — Interactive Brokers execution target (fully automated execution).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no strategy / risk / capital-recovery / position-allocation changes** · **no schema changes** (justification in §16; conclusion: none required) · **no modification to D1–D12** · IBKR is **optional**; **Signals Only remains default**; **Paper remains available**.

---

## 1. Purpose & Stance

D13 designs the **Interactive Brokers (IBKR) execution target** — a concrete realization of the D5 broker boundary that enables fully automated, real-broker execution. Per D11 OD-8 this document is **definition only**: it specifies contracts, lifecycle, reconciliation, recovery, failure handling, security, and paper/live modes. **No client, no connectivity, no implementation is produced here**, and live trading is gated behind a successful Paper validation period and a separate versioned approval.

IBKR plugs in **exactly where Paper already plugs in** (the D11 `ExecutionTarget` seam + the D5 `ExecutionEngine`). The domain core is unchanged: D3 scores, D4 decides, D5 runs the order/position state machines, D6 computes portfolio figures, B9 recovers, B8 operates.

---

## 2. Core Principles (requirements 1–6)

| # | Requirement | Commitment |
|---|-------------|------------|
| 1 | IBKR optional execution target | An `IBKRTarget` (`ExecutionTarget`, `executes()=True`), off unless explicitly selected; one active target per process (D11 OD-7). |
| 2 | Preserve D1–D12 invariants | Additive integration-layer adapter; PostgreSQL truth; separation intact; existing audit/DLQ reused. |
| 3 | No strategy logic changes | D3 untouched; IBKR never scores. |
| 4 | No risk logic changes | D4 untouched; IBKR never gates. The kill switch remains a D4/owner decision; D13 only **records/observes** gateway events. |
| 5 | No capital-recovery changes | B9/D6 recovery path unchanged; IBKR orders/positions are normal rows it already rebuilds. |
| 6 | No position-allocation changes | Quantity is supplied upstream (fixed allocation, V2-001); IBKR never sizes. |

IBKR delegates to the **existing D5 `ExecutionEngine`** for all order/position state, validation, duplicate protection, and verification — **no execution rule is reimplemented** (the Paper target precedent, D11).

---

## 3. Position in the Architecture

```
   D3 Score → D4 Risk (decide)                 [UNCHANGED CORE]
                 │ accepted signal (ExecutionIntent, quantity + mark supplied)
                 ▼
        ┌──────────────────────────────────────────────┐
        │ D11 ExecutionTarget (one active per process)  │
        │  SignalsOnly(default) · Paper · IBKR (D13) ───┼─┐
        └──────────────────────────────────────────────┘ │ executes()=True
                 │ delegates state/validation               │
                 ▼                                          ▼
        D5 ExecutionEngine  create→submit→apply_fill   ┌──────────────────────────┐
        (state machines, validation, dedupe,           │ D13 IBKR Adapter (NEW)    │
         position verification — UNCHANGED)             │  • BrokerExecutionContract│ place/cancel
                 ▲  fills/rejects mapped back           │    (additive placement)   │──► IB Gateway
                 └──────────────────────────────────────│  • IBKRBrokerSyncContract │    /TWS API
                        async→sync bridge (§8 lifecycle) │    (D5 read/sync impl)    │◄── events
                                                         └──────────────────────────┘
   Truth: PostgreSQL (orders/positions/fills)   Audit: system_events GatewayEvent /
   Redis: non-authoritative                     IBGatewayReconnected (existing members)
   Differentiation: Order.broker_ref = "ibkr-paper:…" | "ibkr-live:…"  (OD-5; no schema change)
```

D13 lives at the **integration layer** (`src/app/targets/` + an `ibkr/` adapter package), additive only — D1–D12 unchanged.

---

## 4. BrokerSyncContract Implementation (requirement 8)

The D5 `BrokerSyncContract` is **read/sync only** — `is_connected()`, `fetch_order_view(broker_ref)`, `fetch_open_positions()`. D13 provides:

**`IBKRBrokerSyncContract(BrokerSyncContract)`** — the read/reconcile side:
- `is_connected()` → IB Gateway/TWS session liveness.
- `fetch_order_view(broker_ref)` → maps the IBKR order identified by `broker_ref` to a `BrokerOrderView(broker_ref, status, filled_quantity)`, translating IBKR order states to the **existing `OrderStatus`** enum (no new enum):
  - IBKR `PreSubmitted/Submitted` → `Sent`; `Filled` → `Filled`; `Cancelled/ApiCancelled` → `Cancelled`; `Inactive`/rejected → `Rejected`.
- `fetch_open_positions()` → maps IBKR portfolio positions to `BrokerPositionView(instrument_id, quantity, status)` (existing `PositionStatus`), resolving IBKR contracts → `instrument_id` via the existing `instruments` table.

**`BrokerExecutionContract` (NEW, additive — placement seam):** the D5 sync contract has **no order-placement method** (B5 deliberately modeled `New→Sent` as a state transition + contract boundary, not a network call — B5 assumption 7). D13 therefore adds an **integration-layer placement contract** (NOT a D5 modification):
- `place_order(order) -> broker_ref` — transmit to IBKR; return the broker reference stored in `Order.broker_ref`.
- `cancel_order(broker_ref)` — request cancellation.
- (read side reuses `IBKRBrokerSyncContract`.)

> See **OD-D13-1**: the placement seam is additive (D5 stays frozen); it is not added to D5's `BrokerSyncContract`.

**Enum mapping rule:** every IBKR state maps onto an **existing** `OrderStatus`/`PositionStatus` value. **No new enums, no schema change.**

---

## 5. Order Lifecycle (requirement 9)

`IBKRTarget.handle_accepted(intent)` (delegating to the existing D5 `ExecutionEngine`):

1. **Create** — `ExecutionEngine.create_order(OrderRequest(..., broker_ref="ibkr-<mode>:pending"))` → `New` (D5 validation + duplicate protection run).
2. **Submit** — `ExecutionEngine.submit_order(order)` → `Sent` (D5 state transition + persist). *This is the contract boundary B5 defined.*
3. **Place (D13 outbound)** — `BrokerExecutionContract.place_order(order)` transmits to IBKR; the returned IBKR ref updates `Order.broker_ref` (`ibkr-paper:<id>` / `ibkr-live:<id>`). Placement failure → `ExecutionEngine.reject_order` + DLQ (§13).
4. **Fills (IBKR → THUL-NURAYN, async→sync bridge §8)** — each IBKR fill/exec event is translated to a `Fill` + an OPEN `Position` (or an existing matched position) and applied via `ExecutionEngine.apply_fill(order, fill, position)`; D5 transitions `Sent→Filled` only when total filled == order quantity (partial fills handled natively by D5).
5. **Terminal** — IBKR cancel/reject events map to `ExecutionEngine.cancel_order` / `reject_order`.

D13 performs **broker I/O and event translation only**; **all lifecycle rules, transitions, and validation remain D5's** (no `New→Filled`, immutable fills, single-fingerprint duplicate protection — all enforced by D5 unchanged).

---

## 6. Position Synchronization (requirement 10)

- THUL-NURAYN positions are authoritative in PostgreSQL; IBKR positions are the external reality to be **reconciled against**, never silently overwritten.
- `IBKRBrokerSyncContract.fetch_open_positions()` returns broker positions; D13 compares them to `dal.positions.list(status=Open)` by `instrument_id`, signed quantity (direction), and status.
- **Drift** (broker has a position THUL-NURAYN doesn't, mismatched quantity, or vice-versa) → **alert + DLQ + halt new placements** (operational), **no automatic mutation of domain rows** (consistent with B9 non-destructive recovery, D5 OD philosophy). Resolution is manual.
- Position sync runs as a **B8 scheduler worker** (periodic) and at startup (§12) — additive, reusing the existing `Scheduler`/`Worker` with per-worker failure isolation.

---

## 7. Reconciliation Process (requirement 11)

- **Orders:** reuse the existing **D5 `SyncReconciliation.reconcile_order(internal_order, broker_view, connected)`** — already returns `matched` / `drift` / `disconnected` and is Fail-Safe. D13 supplies `broker_view` via `IBKRBrokerSyncContract.fetch_order_view`.
- **Positions:** a D13 position-reconciler (§6) compares broker vs internal open positions.
- **Outcomes:**
  - `matched` → no action (recorded at low severity / suppressed to avoid noise).
  - `drift` → `system_events` `GatewayEvent` (Critical) + DLQ; **halt new IBKR placements** until an operator resolves; existing positions/orders untouched.
  - `disconnected` → Fail-Safe: **no new placements**; in-flight orders left as-is and re-checked on reconnect; alert.
- **No automatic correction** of domain rows and **no automatic retry** (invariant). Reconciliation **observes and reports**; it never decides risk and never edits history.

---

## 8. Startup Recovery & Async→Sync Bridge (requirement 12)

**Async→sync bridge (architectural keystone):** the IBKR API is **event-driven/asynchronous**; THUL-NURAYN is **synchronous** (psycopg2, synchronous engines, B8 daemon-thread scheduler) and async is a V2 concern. D13 therefore defines an **adapter boundary** that bridges IBKR's async callbacks to synchronous engine calls **without making the core async**:
- An IBKR **adapter thread/event loop** receives IBKR events (order status, executions, position updates) and **enqueues** them.
- A **synchronous drain** (a B8 `Worker` or a dedicated handler) consumes the queue and calls the existing D5 `ExecutionEngine` methods within DAL transactions.
- The core never imports async primitives; the bridge is isolated in the adapter (see **OD-D13-6**).

**Startup recovery sequence (extends B9, does not modify it):**
1. B9 bootstrap runs its read-only rebuilds (PortfolioState, DuplicateOrderProtection, RiskState inputs, kill-switch) from PostgreSQL — **unchanged**.
2. D13 connects to IB Gateway; on success emits **`IBGatewayReconnected`** (existing `SystemEventType` member) + `GatewayEvent`.
3. D13 reconciles internal in-flight orders (`New`/`Sent`) and open positions against IBKR (orders via D5 `SyncReconciliation`, positions via §6).
4. **Drift at startup** → alert + DLQ; trading start is **gated** per **OD-D13-4** (recommended fail-closed for live: do not begin new placements until reconciled).
5. Scheduler still starts **explicitly** (B9 OD-D6) after recovery + reconciliation.

PostgreSQL remains the source of truth; IBKR is reconciled to it, never the reverse.

---

## 9. Failure Handling (requirement 13)

| Condition | Response |
|-----------|----------|
| IB Gateway unreachable at startup | `IBKRTarget.startup_check()` degraded; **no placements**; alert; (live) startup gated (OD-D13-4). PostgreSQL-only operations continue. |
| Connection lost mid-session | `SyncReconciliation` → `disconnected`; **halt new placements**; in-flight orders tracked; alert; await reconnect. **No auto-retry of trades.** |
| Reconnect | Emit `IBGatewayReconnected`; reconcile (§7) before resuming placements. |
| IBKR rejects an order | Map to `ExecutionEngine.reject_order(reason)`; DLQ; operator review. |
| Partial fills | Native D5 behavior (`apply_fill` transitions to `Filled` only at full quantity). |
| Order/position drift | Alert + DLQ + halt new placements; **no silent domain mutation**; manual resolution. |
| Duplicate placement risk | D5 `DuplicateOrderProtection` (fingerprint = signal_id+instrument+engine+direction) blocks duplicates; rebuilt on restart (B9). |
| PostgreSQL unreachable | Upstream B7/B9 fail-safe; IBKR never becomes the source of truth. |
| Event-bridge backlog/overflow | Bounded queue; overflow → alert + DLQ; never drop silently. |

**Principle:** Fail-Safe + DLQ + manual resolution; **no automatic retry** anywhere (invariant); domain history is never recalculated.

---

## 10. Authentication & Security (requirement 14)

| Concern | Design |
|---------|--------|
| Connection | Local connection to **IB Gateway/TWS** (host/port/clientId); IB Gateway handles the authenticated session to IBKR. |
| Credentials | IBKR account credentials live in **IB Gateway / secret manager**, never in THUL-NURAYN code, git, or logs. Connection params (host/port/clientId/account) via **env** (`IBKR_HOST`, `IBKR_PORT`, `IBKR_CLIENT_ID`, `IBKR_ACCOUNT`). |
| Secrets | None in repo; redacted at the B8 logging boundary. |
| Permissions | Least privilege: trading API enabled only for the intended account; market-data/trading scopes per mode. |
| Transport | IB Gateway secured session; local API socket restricted to localhost/allowlist. |
| Mode safety | Live requires explicit, governed enablement (§11, OD-D13-2); paper is the default IBKR mode. |
| Audit of access | Gateway connect/disconnect/reconnect recorded as `system_events` (`GatewayEvent`/`IBGatewayReconnected`). |

---

## 11. Paper vs Live Modes (requirement 15)

There are **two distinct "paper" concepts** — keep them separate:
- **D11 PaperTarget** — *internal simulation*, no broker, no network (already built).
- **D13 IBKR-paper** — the **real IBKR API against an IBKR paper account** (a real connection, simulated money).

**D13 mode selection (`IBKR_MODE`, env; default `paper`):**
- `IBKR_MODE=paper` → connect to the IBKR **paper** account/port; `broker_ref="ibkr-paper:<id>"`.
- `IBKR_MODE=live` → connect to the IBKR **live** account/port; `broker_ref="ibkr-live:<id>"`; **requires explicit owner enablement + versioned approval after a successful paper period** (D11 OD-8; governance-gated, forward-only per `B9_OWNER_POLICY_UPDATE`).

Both modes use the **same tables** (no schema change); they differ only by connection target and the `broker_ref` prefix (OD-5) plus the audited active mode. The B9/D6 recovery path is identical for both. (See **OD-D13-2**, **OD-D13-3**.)

---

## 12. Preserved D1–D12 Invariants

| Invariant | How D13 preserves it |
|-----------|----------------------|
| PostgreSQL sole source of truth | All orders/positions/fills persist via the existing DAL; IBKR is reconciled **to** PostgreSQL. |
| Redis non-authoritative | Not relied upon for correctness. |
| Score Engine authoritative | IBKR never scores. |
| Portfolio ⟂ Risk ⟂ Execution | IBKR acts after D4 accept; delegates execution to D5; never decides risk or computes portfolio. |
| No strategy/risk/capital-recovery/allocation changes | None touched; quantity supplied; recovery unchanged. |
| No new enums | IBKR states map to existing `OrderStatus`/`PositionStatus`. |
| No schema changes | `broker_ref` convention covers paper/live + IBKR refs (§16). |
| No D1–D12 modification | Additive adapter + placement seam; D5 sync contract reused, not modified. |
| Default Signals Only; Paper available | Unchanged. |
| Fail-safe; no auto-retry | Drift/disconnect → DLQ + manual. |

---

## 13. Dependencies

**D13 depends on:** D1 (`Order`/`Position`/`Fill`/`Instrument`/enums), D2 (DAL), D5 (`ExecutionEngine`, `BrokerSyncContract`, `SyncReconciliation`, `OrderRequest`), D11 (`ExecutionTarget` abstraction + the Paper target precedent), B8 (scheduler/workers, DLQ, alerting, `system_events`), B9 (bootstrap/recovery + the explicit-start lifecycle).
**New (implementation-time, owner-gated) dependency:** an IBKR client library (e.g., `ib_insync` or native `ibapi`) + a running **IB Gateway/TWS** — introduced only when the future build is approved (OD-D13-6).
**No dependency** on TradingView, a UI, or any other broker.

---

## 14. Assumptions

1. **Definition-only now** (D11 OD-8): no client, no connectivity, no implementation; live build is a future versioned phase after Paper validation.
2. **Additive integration-layer adapter** (`src/app/targets/` + `ibkr/`); D5's read/sync contract is **reused**; a **new placement contract** is added at the integration layer (D5 unchanged).
3. **IBKR delegates execution to D5**; the only new logic is broker I/O + async→sync event translation.
4. **Quantity and mark are supplied** (no sizing, no price-fetch by the target beyond broker fill data).
5. **PostgreSQL is authoritative**; IBKR is reconciled to it; drift never auto-mutates domain rows.
6. **No automatic retry**; Fail-Safe + DLQ + manual resolution.
7. **IBKR states map to existing enums**; `broker_ref` prefix distinguishes paper/live — **no schema change** (§16).
8. **Async IBKR API is bridged to the synchronous core** via an isolated adapter thread/queue; the core stays synchronous (async is V2).
9. **Live is governance-gated** and forward-only; paper is the default IBKR mode.

---

## 15. Owner Decisions Required

| # | Decision | Alternatives | Recommended |
|---|----------|--------------|-------------|
| **OD-D13-1** | Order-placement seam | (a) **new integration-layer `BrokerExecutionContract`** (D5 frozen); (b) extend D5 `BrokerSyncContract` with `place_order` (modifies D5) | **(a)** — preserves the D5 freeze |
| **OD-D13-2** | IBKR paper vs live selection | `IBKR_MODE=paper\|live`, default **paper**; live requires versioned approval after paper validation | **default paper; live owner-gated** |
| **OD-D13-3** | Paper/live row differentiation | (a) **`broker_ref` prefix `ibkr-paper:` / `ibkr-live:`** (+ audit, no schema change); (b) new column (schema change) | **(a)** — no schema change |
| **OD-D13-4** | Startup/drift trading gate | (a) **fail-closed** (no new placements until reconciled) for live; (b) alert + continue | **(a) for live**, (b) acceptable for paper |
| **OD-D13-5** | Reconciliation cadence | periodic worker interval + on-reconnect; values TBD | periodic + on every (re)connect; tune at build |
| **OD-D13-6** | IBKR client + async bridge | `ib_insync` vs native `ibapi`; bridge via adapter thread + bounded queue | defer library to build; **mandate the isolated async→sync bridge** |
| **OD-D13-7** | Connection model | IB Gateway (headless) vs TWS; clientId/account via env | **IB Gateway (headless)** for automation |
| **OD-D13-8** | Schema change? | (a) **none** (broker_ref suffices, per B5 assumption 5); (b) add exec-id/leg tracking (future versioned) | **(a) none now**; (b) only if multi-leg/exec-id audit later justified |
| **OD-D13-9** | Live enablement governance | before-session/forward-only, explicit owner sign-off + paper-period evidence | **as recommended** (mirrors `B9_OWNER_POLICY_UPDATE`) |

---

## 16. Schema-Change Justification (requirement 7)

**Conclusion: no schema change is required.**
- IBKR order references are stored in the existing free-text `Order.broker_ref` (paper/live distinguished by prefix — OD-D13-3).
- Execution correlation uses `Order.id` + `broker_ref` + `signal_id` + duplicate fingerprint — sufficient per **B5 assumption 5** ("no separate ExecutionId").
- IBKR order/position states map onto the **existing** `OrderStatus`/`PositionStatus` enums; gateway lifecycle uses the **existing** `GatewayEvent`/`IBGatewayReconnected`/`KillSwitchActivated` `SystemEventType` members.
- Drift/DLQ uses the existing append-only `system_events` (`WorkerFailure`) pattern.
- **If** future requirements demand per-execution IDs or multi-leg/combo tracking, that becomes a **justified, versioned schema decision** (OD-D13-8) — explicitly **not** part of this phase.

---

## 17. Definition of Done (requirement 16)

1. `IBKRTarget` (`ExecutionTarget`, `executes()=True`) defined; delegates to the existing D5 `ExecutionEngine`; selectable, optional, one per process.
2. `IBKRBrokerSyncContract` (implements the **existing** D5 read/sync contract) + a **new additive `BrokerExecutionContract`** placement seam (D5 unchanged) defined.
3. **Order lifecycle** (§5) specified end-to-end with all transitions owned by D5.
4. **Position synchronization** (§6) and **reconciliation** (§7) specified, reusing D5 `SyncReconciliation`; drift → alert + DLQ + halt, no auto-mutation.
5. **Startup recovery** (§8) extends B9 (no modification); **async→sync bridge** specified; emits `IBGatewayReconnected`.
6. **Failure handling** (§9): Fail-Safe + DLQ + manual; no auto-retry.
7. **Authentication & security** (§10): IB Gateway; secrets via env/secret manager; redacted; least privilege.
8. **Paper vs live** (§11): `IBKR_MODE` (default paper); live governance-gated after paper validation; `broker_ref` prefix; same tables.
9. **Invariants preserved** (§12); **no strategy/risk/capital-recovery/allocation change**; **no new enums**; **no schema change** (§16); **no D1–D12 modification**.
10. Owner decisions OD-D13-1…9 resolved; D5 freeze preserved via the additive placement seam.
11. (Future build) tests cover: enum/state mapping, lifecycle (create→submit→place→fill→filled), partial fills, order reject, drift/disconnect reconciliation, startup reconciliation gate, idempotency/duplicate protection, async→sync bridge, paper-vs-live `broker_ref` — in-memory/mocked IBKR (no live connectivity in tests).
12. `D13_BUILD_REPORT.md` produced at the future build gate; this document stops at architecture.

---

## 18. Stop Gate (requirement 17)

**STOP.**

Architecture (definition-only) — no code, no implementation, no tests, no connectivity, no source/schema changes, no modification to D1–D12. Per D11 OD-8, IBKR implementation is a **future owner-gated phase that begins only after a successful Paper validation period and explicit versioned approval**. Await owner review and rulings on **OD-D13-1…OD-D13-9** before any D13 implementation begins.
