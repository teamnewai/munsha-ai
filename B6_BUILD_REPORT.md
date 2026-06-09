# B6_BUILD_REPORT

**Phase executed:** B6 — Portfolio & State.
**Authorization:** B1–B5 approved; `B6_PORTFOLIO_ARCHITECTURE.md` approved; `B6_ARCHITECTURE_AUDIT.md` PASS; B6 implementation authorized.
**Implemented exactly per:** `B6_PORTFOLIO_ARCHITECTURE.md` (Master §14–§16 · D6_PORTFOLIO_REPORT).
**Result:** ✅ Complete. **194/194 tests pass** (37 D1 + 30 D2 + 33 B3 + 18 B4 + 33 B5 + **43 B6**), 100% offline.
**Constraints honored:** no new entities, no new enums, no schema change, no broker/API/UI/risk/execution/sizing logic; **D1/D2/D3/D4/D5 unmodified**.

---

## 1. Files Created

| File | Purpose |
|------|---------|
| `src/portfolio/__init__.py` | package exports |
| `src/portfolio/errors.py` | `PortfolioError`, `InvalidCapital`, `PositionStateError` |
| `src/portfolio/models.py` | transient value objects: `AccountState`, `PeriodStats`, `PortfolioSnapshot` |
| `src/portfolio/registry.py` | `OpenPositionsRegistry`, `ClosedPositionsRegistry` |
| `src/portfolio/calculators.py` | `PnLCalculator`, `EquityTracker`, `StatisticsCalculator` |
| `src/portfolio/state.py` | `PortfolioState` aggregate + `_position_exposure` helper |
| `tests/test_portfolio.py` | B6 unit tests (43 tests) |

D2 is used only via an **injected `dal`** parameter (`persist_stats`). No hard imports of D2; portfolio imports only `src.models` + `src.enums` (D1). No coupling to D3/D4/D5.

---

## 2. Component Coverage (D6 report · B6_PORTFOLIO_ARCHITECTURE §17)

| # | Architecture component | Implementation |
|---|------------------------|----------------|
| 1 | `AccountState` value model (capital > 0 fail-safe) | `models.AccountState` + `state.py` `__init__` guard |
| 2 | Open/Closed position registries (`add/remove/list/count`, per-engine filter) | `OpenPositionsRegistry`, `ClosedPositionsRegistry` |
| 3 | `PnLCalculator` — realized (Long/Short) and unrealized (marks; missing mark excluded) | `calculators.PnLCalculator` |
| 4 | `EquityTracker` — equity, HWM, drawdown (`≤ 0`, `= 0` at HWM, D4-aligned) | `calculators.EquityTracker` |
| 5 | `StatisticsCalculator` — D/W/M `PeriodStats` within date windows | `calculators.StatisticsCalculator` |
| 6 | Per-engine allocation vs 70/30 target + exposure figures (monitoring only) | `state.snapshot()` → `PortfolioSnapshot` |
| 7 | `PortfolioState.snapshot(marks) → PortfolioSnapshot` (deterministic, immutable) | `state.PortfolioState.snapshot` |
| 8 | Fail-safe rules (§13): missing mark excluded; drawdown `≤ 0`; capital > 0 | all calculators + `PortfolioState.__init__` |
| 9 | Reuses D1 entities/enums + D2 repos; no new entities/enums/schema; D1–D5 unmodified | confirmed |
| 10 | `PeriodStats` data persisted to existing `performance_records` via D2 | `PortfolioState.persist_stats(stats, dal)` |
| 11 | Sector exposure figure (for D4 consumption) | `PortfolioState.sector_exposure(sector_id, instruments, marks)` |

---

## 3. Tests Added — 43

| Group | Tests | Focus |
|-------|-------|-------|
| `TestPnLCalculator` | 10 | Long/Short realized; missing entry/exit → 0; sum; unrealized Long/Short; missing mark excluded; missing entry excluded; loss case |
| `TestEquityTracker` | 5 | HWM initialized; HWM rises; HWM stable; drawdown = 0 at HWM; drawdown < 0 below HWM |
| `TestOpenPositionsRegistry` | 6 | add+list; list by engine; count by engine; remove; duplicate raises; remove missing raises |
| `TestClosedPositionsRegistry` | 3 | add+list; list by engine; count |
| `TestStatisticsCalculator` | 4 | all wins; mixed W/L; outside window excluded; empty window |
| `TestPortfolioState` | 15 | invalid capital (0); invalid capital (negative); initial state; open position in snapshot; close Long updates cash; close Short updates cash; missing mark excluded from unrealized; HWM rises then drawdown = 0; drawdown negative below HWM; core/turbo counts; 70/30 allocation monitoring; exposure fallback to entry_price; persist_stats creates record; sector_exposure; close not-in-registry raises |

---

## 4. Total Test Count

```
Ran 194 tests in ~0.21s
OK
```
D1: 37 · D2: 30 · B3: 33 · B4: 18 · B5: 33 · **B6: 43** · Total **194**, all green.

---

## 5. Assumptions Made

1. **Transient value objects** — `AccountState`, `PortfolioState`, `PortfolioSnapshot`, and `PeriodStats` are `frozen=True` dataclasses (or mutable aggregates for `PortfolioState`). They are not D1 entities, tables, or enums — consistent with the approved B6 architecture and the B5 DTO precedent.
2. **`cash` convention** — `AccountState.cash = starting_capital + cumulative realized PnL` over all closed positions. HWM and drawdown are computed on current equity = `cash + unrealized_pnl`.
3. **Exposure for allocation** — position exposure uses the current mark if available; falls back to `entry_price`; defaults to zero if neither is present. Exposure is always non-negative (gross risk, not net).
4. **Win/loss convention in `StatisticsCalculator`** — a trade is a win when realized PnL > 0; otherwise a loss (includes breakeven, consistent with `PerformanceRecord.wins + losses = trades`).
5. **`sector_exposure` takes pre-fetched instruments** — B6 does not call `dal.instruments.get` internally; callers pass a `dict[UUID, Instrument]` map, keeping the method pure and testable.
6. **`persist_stats` injects `dal`** — the DAL is not stored on `PortfolioState`; it is passed only when persisting stats, keeping `PortfolioState` usable without a DAL (consistent with the approved "value model" nature).
7. **`PortfolioState.close_position` requires the position to be in the open registry** — raises `PositionStateError` if the position was never opened; this is the B6 fail-safe for inconsistent state (D5's responsibility to call `open_position` before `close_position`).
8. **No new enum introduced** — `period_type` is a plain `str` (`'daily'` / `'weekly'` / `'monthly'`) consistent with the existing `PerformanceRecord.period_type` field and the pre-existing DB CHECK constraint.

No spec rule was changed; no risk/sizing/portfolio-decision/scoring/broker/API/UI logic was added.

---

## 6. Definition of Done (B6_PORTFOLIO_ARCHITECTURE §17)

| Criterion | Status |
|-----------|--------|
| `AccountState` + `PortfolioState` value models (capital > 0 fail-safe) | ✅ |
| Open/Closed registries with `add/remove/list/count` (per-engine filter) | ✅ |
| `PnLCalculator` — realized (Long/Short) and unrealized (missing mark excluded) | ✅ |
| `EquityTracker` — equity, HWM, drawdown (`≤ 0`, `= 0` at HWM, D4-aligned) | ✅ |
| `StatisticsCalculator` — D/W/M `PeriodStats` within date windows | ✅ |
| Per-engine allocation reporting vs 70/30 (monitoring only) and exposure figures | ✅ |
| `PortfolioState.snapshot(marks) → PortfolioSnapshot` (deterministic, immutable) | ✅ |
| Fail-safe rules (§13) hold; all `Decimal`; deterministic | ✅ |
| Reuses D1 entities/enums + D2 repos; no new entities/enums/schema; D1–D5 unmodified | ✅ |
| Critical-path unit tests green; full suite (194/194) green | ✅ 43 / 194 |
| `B6_BUILD_REPORT.md` produced; stop at gate | ✅ |

---

## B6 GATE

**B6 is COMPLETE.** Stopping at the B6 review gate.
**B7 has NOT been started** and will not begin without owner review/approval.

**STOP — awaiting review.**
