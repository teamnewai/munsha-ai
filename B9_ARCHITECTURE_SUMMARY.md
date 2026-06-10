# B9_ARCHITECTURE_SUMMARY

**Concise owner-review summary of `B9_INTEGRATION_ARCHITECTURE.md`.** Architecture only — no code, no tests, no schema/source changes.
**Phase:** B9 — Integration & Recovery. **Prereq:** B1–B8 approved/frozen (254 passed / 23 skipped @ `200e9bf`).

---

## 1. What B9 Is

The **integration & recovery** layer. It composes the already-built phases (D1–D6 domain, B7 persistence, B8 operations) into one runnable application and defines how transient in-memory state is **rebuilt from PostgreSQL on startup/restart**. It is **wiring + read-only rebuild glue** — no domain logic.

## 2. What B9 Adds

- A new package `src/app/`: **bootstrap** (composition root) + **recovery** (rebuild flows). Analogous to how B8 added `src/operations/`.
- Ordered startup/shutdown, single-DAL dependency wiring, health-gated bring-up, scheduler start, and an end-to-end pipeline wiring over the durable DAL.

## 3. Startup Sequence (high level)

`config/logging → ConnectionPool + RedisClient → PostgresDataAccessLayer → B8 operations → recovery (rebuilds) → D3–D6 engines → start scheduler`. PostgreSQL unreachable ⇒ **abort**. Redis down ⇒ **DEGRADED**, continue.

## 4. The Four Rebuilds (all read-only from PostgreSQL)

| Aggregate | Owner phase | Rebuilt from | Method |
|-----------|-------------|--------------|--------|
| `PortfolioState` | D6 | closed + open `positions` + `starting_capital` (config) | replay via `open_position`/`close_position`; cash = capital + Σ realized PnL |
| `DuplicateOrderProtection` | D5 | `orders` in `New`/`Sent` | re-`register(order)` (D5 computes fingerprint) |
| `RiskState` inputs | D4 | positions/orders counts + D6 figures + kill-switch level | B9 *supplies inputs*; **D4 rules unchanged** |
| Kill-switch level cache | B8 | latest `KillSwitchActivated` in `system_events` | `KillSwitchLevelCache.rebuild()`; **B9 never sets level** |

Redis is **cold** on restart and is **warmed from PostgreSQL** after rebuilds (skipped if Redis down).

## 5. Separation & Boundaries (unchanged)

- **Portfolio ⟂ Risk ⟂ Execution**: D6 computes figures, D4 decides, D5 executes. B9 only wires and supplies inputs.
- **Broker boundary**: D5 `BrokerSyncContract` (ABC) wired to a **mock/in-memory** implementation only — no network, no D7.
- **B8 partition detector stays detect-only (A2)**: B9 backs it with **read-only** `pg_catalog` queries; no partition creation.

## 6. The Five "No" Answers

| Question | Answer |
|----------|--------|
| New entities? | **No** |
| New tables? | **No** |
| New enums? | **No** |
| Schema changes? | **No** |
| Modifications to D1–D8? | **No** (B9 imports/orchestrates only; adds `src/app/`) |

## 7. Recovery & Restart Guarantees

- **Source of truth:** PostgreSQL only; Redis non-authoritative.
- **Read-only, non-destructive recovery:** inconsistencies are surfaced as B8 alert + DLQ entry — never silently repaired.
- **Idempotent & deterministic:** crash-restart ≡ graceful restart; repeated recovery yields the same state and writes nothing.
- **In-flight orders** (`New`/`Sent`) re-registered so duplicates stay blocked after restart.
- **No automatic retry** anywhere; DLQ resolution remains manual.

## 8. Graceful Shutdown

Stop scheduler → let in-flight DAL work settle (B7 transactions) → emit `ServiceStopped` → close pool. No domain writes; no data loss (all durable state is in PostgreSQL).

## 9. Failure Handling (summary)

PostgreSQL down at startup ⇒ abort. Redis down ⇒ DEGRADED. PostgreSQL lost mid-op ⇒ propagate to Fail-Safe; affected unit dead-lettered. Worker failure ⇒ recorded + dead-lettered; scheduler survives. Kill-switch L4 ⇒ operational `SHUTDOWN` surfaced (pausing owned by D4/D5).

## 10. Definition of Done (essentials)

Bootstrap + recovery package; health-gated startup; four rebuilds correct; scheduler start/stop; observational health/state; E2E pipeline over durable DAL with mock broker; **all 254 existing tests green** + new B9 integration tests; D1–D8 unmodified; no schema/table/enum/secret changes; `B9_BUILD_REPORT.md`; stop at gate.

## 11. Key Assumptions

`starting_capital` is config (not persisted) · marks are supplied at snapshot time, not during rebuild · `trades_today`/`consecutive_losses` derived read-only as D4 inputs (no rule change) · broker = mock only · `pg_catalog` readers read-only · single synchronous process · in-memory DAL is the default test backend, PostgreSQL E2E behind `DATABASE_URL`.

## 12. Stop Gate

**STOP.** Architecture only. Await owner review and approval before any B9 implementation begins.
