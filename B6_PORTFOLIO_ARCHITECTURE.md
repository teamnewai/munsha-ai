# B6_PORTFOLIO_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No tests. No source changes. No schema changes. No new entities. No new enums.**
**Derived strictly from:** Master Specification §14–§16 (capital protection / position sizing context, risk limits) · D6_PORTFOLIO_REPORT · approved B1 Foundation · B2 Data Access · B3 Selection · B4 Risk · B5 Execution.
**Resume point:** `PROJECT_STATE_CHECKPOINT.md` @ `ad0bf99` · 151/151 tests passing.
**Status:** Architecture only — implementation forbidden until owner approval.

---

## 1. Purpose of B6

B6 tracks **account and portfolio state and statistics** — equity, realized/unrealized PnL, high-water mark, drawdown, open/closed position registries, per-engine allocation, exposure, and period statistics — and produces a read-only `PortfolioSnapshot`. It **computes from passed-in data; it does not fetch prices, size positions, decide risk, or execute** (D6_PORTFOLIO_REPORT scope).

---

## 2. Responsibilities

**B6 IS allowed to:**
- Maintain account state (starting capital, cash) as a computed value model.
- Track open/closed positions in registries (filterable by engine).
- Compute realized PnL (closed, Long/Short), unrealized PnL (open + passed-in marks), equity, HWM, and drawdown.
- Compute Daily/Weekly/Monthly statistics (trades/wins/losses/realized/win_rate).
- Report per-engine allocation against the 70/30 target and current exposure figures.
- Produce a deterministic `PortfolioSnapshot`.
- Persist period statistics via D1 `performance_records` (through D2).

**B6 is FORBIDDEN to:**
- Size positions (V2-001 — risk-based sizing forbidden; fixed sizing is not B6's job).
- Make or enforce risk decisions / gates (that is D4).
- Run order/position state machines or send orders (that is D5).
- Connect to a broker, fetch market data/prices, or expose an API/UI.
- Compute scores or classifications (that is D3).

**Separation:** B6 **computes state**; D4 **decides risk** (consuming B6's figures via `RiskState`); D5 **executes**. Portfolio ⟂ Risk ⟂ Execution.

---

## 3. Inputs from D1–D5

| Source | Input | Use |
|--------|-------|-----|
| **D1** | `Position`, `Fill` entities; `PositionStatus`, `EngineType`, `Direction` enums | the data B6 aggregates (reused unchanged) |
| **D2** | repositories (`positions`, `fills`, `performance_records`) + lookups | read open/closed positions & fills; persist statistics |
| **D5** | Fills/Positions produced by execution (`Open`/`Closed` via the D5 state machine) | the source of position lifecycle events B6 reflects |
| **(passed-in)** | **marks** — current prices per instrument | unrealized PnL / equity (NOT fetched by B6) |
| **(configuration)** | **starting capital** | seeds `AccountState` (no `accounts` table exists; see §5) |

> B6 imports only D1 (entities/enums) and uses D2 via an injected DAL. It does **not** import D3/D4/D5 logic.

---

## 4. Outputs Consumed by Later Phases

| Output | Consumer |
|--------|----------|
| `PortfolioSnapshot` (equity, cash, realized, unrealized, HWM, drawdown, open/core/turbo counts) | D4 risk loop (figures → `RiskState`), D8 monitoring, D9 UI portfolio view |
| Drawdown / exposure / open-count figures | **D4** `RiskState` inputs (B6 supplies; D4 decides) |
| `PeriodStats` (D/W/M) | D8/D9 reporting; persisted as `performance_records` |
| Per-engine allocation (Core/Turbo vs 70/30) | D8/D9 monitoring |

---

## 5. Portfolio State Model

Transient **computed value objects** (read models) — **not** D1 persisted entities, tables, or enums (same precedent as the approved B5 DTOs). Persisted data lives in existing D1 tables (`positions`, `fills`, `performance_records`).

```
AccountState ────────────┐
OpenPositionsRegistry ───┐│
ClosedPositionsRegistry ─┤│
                         ▼▼
                   PortfolioState ──snapshot(marks)──► PortfolioSnapshot
                         │                              (equity, cash,
            EquityTracker (HWM, Drawdown)                realized, unrealized,
            PnLCalculator (realized / unrealized)        HWM, drawdown,
            StatisticsCalculator (D/W/M)                 open/core/turbo counts)
```

- **AccountState:** `starting_capital`, `cash` (seeded from configuration + realized PnL). *No `accounts` table exists in D1 → AccountState is a value model, consistent with "no new entities". PostgreSQL remains the source of truth for persisted entities; account/portfolio state is computed.*
- **PortfolioState:** aggregates `AccountState` + registries + `EquityTracker`.
- **PortfolioSnapshot:** a read-only computed point-in-time view.

---

## 6. Position State Model

B6 **reflects** the D1/D5 position lifecycle; it does **not** own a state machine.

- A position is held in the **OpenPositionsRegistry** while `PositionStatus.OPEN`.
- On close (`Open → Closed`, performed by the D5 `PositionStateMachine`), B6 moves it to the **ClosedPositionsRegistry** and computes its realized PnL (Long/Short aware).
- B6 reuses D1 `Position` and `PositionStatus`; closed-position realized PnL is computed by `PnLCalculator` (a calculation, not a new entity).

```
   (D5 closes position)            B6 reflection
   Position.OPEN  ───────────────► OpenPositionsRegistry
        │ Open → Closed (D5)
        ▼
   Position.CLOSED ──────────────► ClosedPositionsRegistry  (+ realized PnL)
                                    AccountState.cash / Equity / HWM / Drawdown recomputed
```

---

## 7. Portfolio Metrics

All `Decimal`, deterministic:
- **Realized PnL** — sum over closed positions (Long: exit−entry; Short: entry−exit), via `PnLCalculator.realized(closed)`.
- **Unrealized PnL** — over open positions using passed-in marks, via `PnLCalculator.unrealized(open, marks)`.
- **Equity** — `cash + open-position value (+ unrealized)`, via `EquityTracker.equity(open, marks)`.
- **High Water Mark** — highest equity observed (from starting capital), `EquityTracker.update_high_water_mark` / `high_water_mark`.
- **Drawdown** — `(equity − HWM) / HWM`, `≤ 0`, `= 0` at HWM — **same convention as D4** (so D4's drawdown gates consume consistent figures).
- **Counts** — total open, `core_open`, `turbo_open` (independent engine monitoring, A.7).

---

## 8. Capital Allocation Model

- **Target:** 70% Core / 30% Turbo of capital (Master §15).
- B6 **reports** the current Core vs Turbo allocation (by exposure/value and by count) **against** the 70/30 target. It is a **monitoring/read** model.
- B6 does **not** allocate or size — sizing is forbidden (V2-001); enforcement, if any, is a risk/operational concern, not B6.

---

## 9. 70/30 Allocation Rules

- Compute `core_allocation` and `turbo_allocation` from open positions (per-engine value or capital share).
- Surface them in `PortfolioSnapshot` alongside the 70/30 target for monitoring (D8/D9).
- **Reporting only** — B6 raises no error and blocks nothing on a 70/30 deviation (that is not a B6 responsibility). No new behavior introduced.

---

## 10. Exposure Tracking

- **Per-engine exposure:** Core vs Turbo open exposure (read figures).
- **Sector exposure (read):** B6 may compute current sector exposure from open positions (joining via `instruments.sector_id`) as a **figure** that D4 consumes in `RiskState` for its ≤25% sector gate. B6 supplies the number; **D4 enforces** the limit. B6 never gates.
- Exposure figures are deterministic reads; no thresholds enforced in B6.

---

## 11. Portfolio Constraints

B6 is **aware of** and **reports against** these constraints but does **not** enforce them (enforcement = D4 Risk):
- Max 5 open positions · 70/30 Core/Turbo · sector exposure ≤ 25%.

B6 provides the counts/figures; the **Risk Gate (D4)** makes accept/reject decisions. This preserves Portfolio ⟂ Risk.

---

## 12. State Transitions

B6 owns **no** state machine. The only transition it reflects is **Position `Open → Closed`** (owned by D5). On reflection:
- Move position Open→Closed registries.
- Compute realized PnL for the closed position.
- Recompute cash, equity, HWM, drawdown.

`PortfolioSnapshot` itself is immutable once produced (a read model). Account/portfolio mutations occur only through registry add/close and recompute.

---

## 13. Fail-Safe Rules

- **Missing mark:** an open position **without** a current price (mark) is **excluded** from unrealized PnL / equity — no price is assumed (D6_PORTFOLIO_REPORT §6).
- **Invalid capital:** non-positive starting capital is rejected (fail-safe; capital > 0).
- **Drawdown invariant:** drawdown `≤ 0` and `= 0` at the HWM — never reports a positive drawdown.
- **Deterministic:** identical inputs → identical snapshot; no randomness, no I/O in the calculators.
- No assumptions beyond the above (all sourced from Master §15/§16 and D6 §6).

---

## 14. Data Access Requirements

Uses **existing** D2 interfaces only — **no new repositories, no schema changes, no SQL**:

| D2 repository / helper | Operations B6 may use |
|------------------------|-----------------------|
| `positions` | `list` (by `status`, by `engine`), `get` |
| `fills` | `list`, `fills_for_position` |
| `performance_records` | `add`, `list` (persist D/W/M statistics) |
| `instruments` | `get` (sector lookup for exposure) |
| `DataAccessLayer.transaction()` | wrap multi-record updates if needed |

Marks (prices) are **passed in**, never read from a broker or market-data source.

---

## 15. Dependencies

**B6 depends on:** D1 (Position/Fill entities; PositionStatus/EngineType/Direction enums) · D2 (repositories) · D5 (fills/positions lifecycle output).
**Future consumers of B6:** D4 (risk-loop figures via `RiskState`) · D8 Operations (monitoring) · D9 UI (portfolio view) · B9 Integration/E2E (wiring).

---

## 16. Out of Scope (explicitly prohibited in B6)

- Position sizing (V2-001)
- Risk decisions / gating / limit enforcement
- Order/position execution or state-machine ownership
- Broker / IBKR / market-data / price fetching
- API / FastAPI / webhooks
- UI / dashboard
- Scoring / classification

---

## 17. Definition of Done (criteria for the future B6 build)

1. `AccountState` + `PortfolioState` value models (capital > 0 fail-safe).
2. Open/Closed position registries with `add/remove/list/count` (per-engine filter).
3. `PnLCalculator` — realized (Long/Short) and unrealized (open + marks; missing mark excluded).
4. `EquityTracker` — equity, HWM, drawdown (`≤ 0`, `= 0` at HWM, D4-aligned).
5. `StatisticsCalculator` — D/W/M `PeriodStats` (trades/wins/losses/realized/win_rate within date windows).
6. Per-engine allocation reporting vs 70/30 (monitoring only) and exposure figures.
7. `PortfolioState.snapshot(marks) → PortfolioSnapshot` (deterministic, immutable read model).
8. Fail-Safe rules (§13) hold; all `Decimal`; deterministic.
9. Reuses D1 entities/enums + D2 repositories; **no new entities/enums/schema**; D1–D5 unmodified.
10. Critical-path unit tests green (Long/Short realized, unrealized with/without marks, equity, HWM, drawdown=0 at HWM, registries by engine, statistics windows, snapshot, missing-mark fail-safe, 70/30 reporting); full suite remains green.
11. `B6_BUILD_REPORT.md` produced; stop at the B6 gate.

---

## 18. Stop Gate

**STOP.**

Await owner approval. Implementation is forbidden until approval is granted.
This document is architecture only — no code, no tests, no source/schema changes, no new entities or enums.
