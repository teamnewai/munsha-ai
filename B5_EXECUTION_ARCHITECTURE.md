# B5_EXECUTION_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No files under `src/`. No implementation.**
**Derived strictly from:** Master Specification §20 (Execution Logic) · D5_EXECUTION_DOMAIN_REPORT · approved B1 Foundation · B2 Data Access · B3 Selection · B4 Risk Gate.
**Status:** Architecture only — implementation forbidden until owner approval.

---

## 1. Purpose

B5 implements the **internal execution domain** — how Orders, Fills, and Positions behave via lifecycle state machines, validation, duplicate protection, position verification, broker-synchronization **contracts** (abstract), and audit event flow.

**B5 is ALLOWED to:**
- Build an `Order` (D1 entity) in `New` from an accepted, validated request.
- Enforce the Order / Position state machines (legal transitions only).
- Validate orders and validate that `Σ fills ≤ order.quantity`.
- Apply duplicate-order protection (fingerprint).
- Verify positions (unique / open / symbol+engine match).
- Define `BrokerSyncContract` (ABC) and the internal `SyncReconciliation` logic.
- Emit execution events to `audit_logs` (append-only, via D2).
- Persist Orders/Fills/Positions via D2 repositories.

**B5 is FORBIDDEN to:**
- Connect to any broker / IBKR / TradingView; perform live or paper trading.
- Open network sockets, call APIs, or process webhooks.
- Compute position size, risk decisions, portfolio analytics, scores, or classifications.
- Retry failed risk/execution-path messages automatically (DLQ is manual).

**No-overlap confirmation:**
- **D3 = Selection** (what to trade — regime/scan/score/rank/classify).
- **D4 = Risk** (whether the trade is allowed — accept/reject).
- **D5 = Execution** (how an accepted order moves through its lifecycle — state, integrity, reconciliation).
B5 starts only *after* D4 returns **Accepted**; it never re-scores (D3) and never re-decides risk (D4). **Risk ⟂ Execution.**

---

## 2. Inputs (interfaces only)

| Source | Input | Description |
|--------|-------|-------------|
| **D4** | `RiskDecisionResult` | Must be **Accepted**; a non-accepted result halts B5 (no order). |
| **D3** | `ScoredCandidate` | Provenance: `symbol`, `engine` (EngineType), `direction` (Direction); source for the duplicate fingerprint. |
| **(upstream)** | order **quantity** | Pre-computed by sizing **outside B5** (sizing is forbidden here, §11). Passed in. |
| **D1** | `Order`, `Fill`, `Position` entities; `OrderStatus`, `PositionStatus`, `Direction`, `EngineType` enums | Reused **unchanged**; B5 does not redefine them. |
| **(assembled)** | `OrderRequest` (value object) | `signal_id`, `instrument_id`, `user_id`, `engine`, `direction`, `quantity` — the validated execution intent assembled from the accepted candidate. |

> Interface intent only — no signatures-as-code. B5 consumes passed-in data; it computes none of the upstream facts.

---

## 3. Outputs

**Execution outputs (state):**
- `Order` entity transitioning through `OrderStatus` (persisted via D2).
- `Fill` entities (immutable events) linked to one Order and one Position.
- `Position` entity transitioning `Open → Closed`.

**Execution events:**
- `order_event` and `error_event` records written to `audit_logs` (append-only) — one per meaningful state change or failure (D5 §9 Audit Event Flow).

**Execution results (return value objects, described — not code):**
- An *acceptance/rejection* result for order creation (accepted → New, or rejected with a reason: duplicate / validation / safety-layer).
- A *transition* result from the state machines (`can_transition` boolean; `transition` success or `IllegalTransition`).
- A *reconciliation* result (matched / drift / disconnected) from `SyncReconciliation`.

---

## 4. Execution State Machine

**ORDER** (terminal states: `Filled`, `Rejected`, `Cancelled`):

```
                ┌──────────────► Rejected   (terminal)
                │
   New ─────────┼──────────────► Cancelled  (terminal)
    │           │
    └──► Sent ──┼──────────────► Filled     (terminal)
                ├──────────────► Rejected
                └──────────────► Cancelled
```
- **Required path to fill:** `New → Sent → Filled`.
- **Invalid transitions (rejected as `IllegalTransition`):** `New → Filled` (must pass `Sent`); any transition *out of* a terminal state; any transition not drawn above.

**POSITION** (terminal: `Closed`):

```
   Open ──────► Closed     (Closed → Open is FORBIDDEN)
```

**FILL:** a single immutable event — created once, never transitions, never updated/deleted.

**Cardinalities (Master §20):** `Order 1─* Fill` · `Fill *─1 Position` · `Order *─1 Position`. Path: **Execution → Fill → Portfolio → Position.**

---

## 5. Order Lifecycle

1. **Order Creation** — from an accepted `OrderRequest`: run Order Validation + Duplicate Protection; on success create `Order` in `New`; register the fingerprint; emit audit event.
2. **Order Submission** — `New → Sent` once handed to the (future) broker contract; emit audit event. (No broker connection in B5; submission is a state transition + a `BrokerSyncContract` call boundary.)
3. **Acknowledgement** — a broker acknowledgement (via the contract, supplied later) keeps the order in `Sent`; absence/ambiguity is handled Fail-Safe (§7).
4. **Fill Processing** — each `Fill` is appended; validation enforces `Σ fills ≤ order.quantity`; fully-filled order transitions `Sent → Filled`; fills attach to the verified Position.
5. **Completion** — order reaches `Filled` (terminal); Position remains `Open` until closed by a later (exit) order/flow; emit audit event.
6. **Cancellation** — `New → Cancelled` or `Sent → Cancelled` (terminal); emit audit event.
7. **Rejection** — `New → Rejected` or `Sent → Rejected` (terminal), e.g., a broker safety-layer rejection or validation failure; emit audit event.

> No broker implementation. Submission/ack/fill *ingestion* occur through the abstract `BrokerSyncContract`; the concrete adapter is D7.

---

## 6. Idempotency Rules

- **Duplicate protection (order-level):** fingerprint = `(signal_id + instrument + engine + direction)` (D5 §6). `is_duplicate` rejects a second order with the same active fingerprint; `register` on creation; `release` on terminal/closed.
- **Replay protection:** a replayed request with an already-registered fingerprint is rejected as duplicate; terminal orders keep their record (append-only audit) so replays are detectable.
- **Repeated signal handling:** repeated identical signals map to the same fingerprint → at most one live order; subsequent ones rejected.
- **Repeated webhook handling:** webhooks are **out of D5 scope** (no API/webhooks in B5). When an API layer (4B) exists it must dedupe at ingress, and B5's order fingerprint is the **final** safeguard against duplicate orders. *(Stated only to bound scope; not implemented in B5.)*

---

## 7. Fail-Safe Rules

**Reject conditions (Order Rejected / IllegalTransition):**
- Any state transition not explicitly allowed (§4) → `IllegalTransition`.
- Order validation failure; `Σ fills > order.quantity`.
- Duplicate fingerprint.
- Position verification failure (not unique / not open / symbol or engine mismatch).
- Any broker safety-layer failure (code validity · liquidity · size · risk rules · trading hours, Master §20) → **Order Rejected**.

**Halt conditions:**
- Broker **disconnected** or sync **drift** detected by `SyncReconciliation` → block new orders; route to Fail-Safe (no pass-through). Integrates with Kill Switch (L3 Pause Execution) at the operations layer.
- Any missing/invalid input or unexpected exception on the execution path → raise (never silently proceed); message routed to **DLQ** with **no automatic retry**.

**Recovery behavior:**
- Failed execution-path messages land in the **DLQ** for **manual** owner-supervised resolution (no auto-retry).
- After any recovery, **reconciliation precedes resumption** (internal state vs broker view) before new orders are allowed.
- No assumptions beyond the above — all conditions are sourced from Master §20 and D5 §6/§9.

---

## 8. BrokerSyncContract (contract only)

Abstract interface — **no adapter, no IBKR, no API, no networking** (D5 §5; concrete impl is D7):

| Member | Purpose |
|--------|---------|
| `is_connected` | report connectivity (read-only) |
| `fetch_order_view(broker_ref)` | return the broker's view of one order |
| `fetch_open_positions()` | return the broker's open positions |
| `SyncReconciliation.reconcile_order(internal, broker_view)` | compare internal vs broker; classify **matched / drift / disconnected**; Fail-Safe on drift/disconnect |

B5 defines these as `ABC`s/value-objects only. Submission/cancel/fill-fetch belong to the D7 `BrokerAdapter` that *extends* this contract.

---

## 9. Data Access Usage

B5 uses **existing** D2 interfaces only — **no new repositories, no schema changes, no SQL**:

| D2 repository / helper | Operations B5 may use |
|------------------------|-----------------------|
| `orders` | `add`, `get`, `get_or_none`, `update`, `list` |
| `fills` | `add`, `list` |
| `positions` | `add`, `get`, `update`, `list` |
| `audit_logs` | `add` **only** (append-only; update/delete forbidden) |
| DAL structural lookups | `fills_for_order`, `fills_for_position`, `orders_for_position` |
| `DataAccessLayer.transaction()` | wrap multi-entity execution steps |

No D2 contract is modified; B5 is a consumer of the D2 ABC (InMemory now; PostgresRepository in B7).

---

## 10. Dependencies

**B5 depends on:**
- **D1** — `Order`/`Fill`/`Position` entities; `OrderStatus`/`PositionStatus`/`Direction`/`EngineType` enums.
- **D2** — repositories + transaction boundary + structural lookups.
- **D4** — `RiskDecisionResult` (only `Accepted` proceeds).
- **D3** — `ScoredCandidate` (provenance/fingerprint source) — indirect.

**Future consumers of B5:**
- **D6 Portfolio** — consumes Fills/Positions to compute equity/PnL/drawdown.
- **D7 Broker** — implements `BrokerSyncContract`/`BrokerAdapter` (Paper first).
- **D8 Operations** — monitors `audit_logs`/`system_events`, DLQ, health, Kill Switch L3.
- **D9 UI** — reads order/position state for display.

---

## 11. Out of Scope (explicitly prohibited in B5)

- Position sizing
- Risk calculations / risk decisions
- Portfolio analytics (equity / PnL / HWM / drawdown)
- Scoring
- Classification
- Broker implementation (IBKR / adapter / networking)
- API implementation (FastAPI / webhooks)
- UI logic

---

## 12. Definition of Done (criteria for the future B5 build)

1. Order & Position **state machines** enforce only the legal transitions in §4; every illegal transition raises `IllegalTransition`; terminal states are immutable.
2. **Order Validation Layer** enforces order correctness and `Σ fills ≤ order.quantity`.
3. **Duplicate Order Protection** (fingerprint) rejects duplicates; `register`/`release` lifecycle correct.
4. **Position Verification** enforces unique/open/symbol+engine match.
5. **BrokerSyncContract** (ABC) + `SyncReconciliation` defined; drift/disconnect → Fail-Safe (no networking).
6. **Audit Event Flow** writes execution events to `audit_logs` (append-only, via D2).
7. **Fail-Safe** holds on every path (§7); DLQ routing is manual (no auto-retry).
8. Uses **D1 entities** and **D2 repositories** only; D1/D2/D3/D4 unmodified.
9. **Critical-path unit tests** green: illegal transitions, terminal-state immutability, `New→Filled` forbidden, duplicate reject, fills-exceed-qty, position mismatch, reconcile drift/disconnect Fail-Safe; full suite remains green.
10. `B5_BUILD_REPORT.md` produced; stop at the B5 gate.

---

## 13. Stop Gate

**STOP.**

Await owner approval. Implementation is forbidden until approval is granted.
This document is architecture only — no code, no files under `src/`, nothing implemented.
