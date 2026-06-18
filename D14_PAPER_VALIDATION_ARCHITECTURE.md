# D14_PAPER_VALIDATION_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No implementation. No tests. No source changes. No schema changes.**
**Derived from:** approved B1–B9 artifacts · `D11_EXECUTION_TARGETS_ARCHITECTURE.md` (Paper target) · `D13_IBKR_INTEGRATION_ARCHITECTURE.md` (the gate this feeds) · `D6 Portfolio` (calculators) · `B8_OPERATIONS_ARCHITECTURE.md` (reporting/metrics) · `B9_OWNER_POLICY_UPDATE.md` (governance).
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** D14 — Paper validation framework (the eligibility gate **before any live broker deployment**).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no strategy / risk / execution-rule / capital-recovery / position-allocation changes** · no new tables · no new enums · no schema changes · **no modification to D1–D13**.

---

## 1. Purpose & Stance

D14 defines the **validation framework** that must be satisfied during a **Paper Trading** period before the (future, owner-gated) IBKR live build (D13) may be enabled. It is a **read-only analytics, reporting, and governance-gate layer** over data already persisted by paper trading.

D14 **measures**; it never trades, scores, gates, sizes, or recovers. Every metric is **computed from existing persisted rows**, reusing the D6 calculators wherever a formula already exists — so no strategy/risk/execution/portfolio formula is duplicated or changed. The approval thresholds are **governance configuration** (owner-set business policy), not trading rules embedded in D3/D4/D5.

---

## 2. Core Principles (requirements 1–9)

| # | Requirement | Commitment |
|---|-------------|------------|
| 1 | Validate via Paper Trading only | D14 analyzes persisted **paper** rows (D11 `PaperTarget`; `broker_ref="paper:…"`). |
| 2 | No IBKR implementation | D14 builds no broker code; it only *gates* the future D13 build. |
| 3 | No live trading | Read-only analytics; D14 places no orders of any kind. |
| 4–8 | No strategy/risk/execution/capital-recovery/allocation changes | D14 is observational; it reuses D6 formulas and changes none. |
| 9 | Preserve D1–D13 invariants | Additive read-only layer; PostgreSQL truth; separation intact; no schema change. |

**Separation guarantee:** validation thresholds are **eligibility gates** (governance), distinct from D4 risk gates. Passing/failing validation changes *deployment eligibility*, never a trading decision.

---

## 3. Data Sources (all existing; read-only)

| Source (existing) | Used for |
|-------------------|----------|
| `positions` (closed/open, `entry_price`/`exit_price`/`direction`/`engine`/`instrument_id`) | PnL, drawdown, streaks, long/short, sector |
| `fills` | execution confirmation, fill prices |
| `orders` (`signal_id`, `broker_ref`) | trade↔signal linkage; paper tagging (`paper:`) |
| `signals` + `scores` (`classification`, `total`) | score-band attribution (1:1 `signal_id`) |
| `instruments` (`sector_id`, `market`) | sector performance |
| `market_snapshots` (`regime`) + `scanner_results` (`market_snapshot_id`) | regime attribution (where linked) |
| `performance_records` (daily/weekly/monthly) | core period stats (written by D6 `persist_stats`) |
| `system_events` / DLQ | integrity signals (kill-switch, worker failures during paper) |

**D6 reuse (no duplication):** `PnLCalculator.realized_for_position` (per-trade PnL), `StatisticsCalculator.stats` (trades/wins/losses/win_rate; win = PnL > 0 — B6 assumption 11), `EquityTracker` (HWM, drawdown ≤ 0). D14 aggregates these read-only; it re-implements no formula.

---

## 4. Validation Metrics (requirements 10–20)

All metrics are computed read-only from §3 over a validation window. Equity curve = `starting_capital + cumulative realized PnL` ordered by `closed_at` (the D6 cash convention, unchanged).

| # | Metric | Definition / formula | Source / reuse | Caveat |
|---|--------|----------------------|----------------|--------|
| 10 | **Win Rate** | wins / trades (win = realized PnL > 0) | D6 `StatisticsCalculator` | — |
| 11 | **Profit Factor** | Σ winning PnL / \|Σ losing PnL\| | aggregate `PnLCalculator` per closed position | undefined (∞) if no losses → report as "no losses" |
| 12 | **Average R Multiple** | mean of per-trade R, where **R basis must be defined** | per-trade PnL ÷ risk basis | **v1 persists no stop/risk basis** → needs OD-D14-1 (proxy or defer) |
| 13 | **Maximum Drawdown** | min over the curve of (equity − HWM)/HWM ≤ 0 | D6 `EquityTracker` | D4-aligned sign convention |
| 14 | **Recovery Performance** | trades & calendar time from each drawdown trough back to a new HWM (worst + average) | derived from equity curve | "unrecovered" if still below HWM at window end |
| 15 | **Consecutive Wins/Losses** | max win streak, max loss streak over ordered closed trades | win/loss convention (B6) | extends B9 trailing-streak logic to max streaks |
| 16 | **Portfolio Return** | (equity_end − starting_capital) / starting_capital | D6 cash/snapshot | `starting_capital` from config (B9 D1) |
| 17 | **Sector Performance** | per `instrument.sector_id`: trades, win rate, net PnL, contribution % | join position→instrument | — |
| 18 | **Regime Performance** | per `market_snapshots.regime` at signal time: trades, win rate, net PnL | join order→signal→scanner→market_snapshot | **only where the regime linkage exists**; else bucket "unknown" (OD-D14-2) |
| 19 | **Long vs Short Performance** | per `position.direction`: trades, win rate, net PnL, profit factor | group by direction | — |
| 20 | **Score Band Performance** | per `score.classification` (UltraGolden/Golden/Strong/Watchlist): trades, win rate, net PnL | join order.signal_id→score | validates that higher bands outperform (sanity of D3) |

All metrics are **deterministic and reproducible** from the same persisted data (no hidden state). They are surfaced as a transient `ValidationReport` value object (not a persisted entity — see §5).

---

## 5. Reporting (requirements 21–24)

**Period reports (21–23):** generated by a B8-style read-only worker.
- **Core period stats** (trades/wins/losses/realized_pnl/win_rate) for **daily / weekly / monthly** are written via the **existing** `performance_records` table (D6 `persist_stats`; `period_type` already supports these values). **No schema change.**
- **Extended validation metrics** (profit factor, drawdown, R proxy, recovery, streaks, sector/regime/direction/band breakdowns) are **computed read-only** into a `ValidationReport` and **exported as report artifacts** (e.g., JSON/markdown files, or B8 metrics output) — they are **not** persisted as new entities (no new table). They are fully reproducible from source rows on demand.

> **OD-D14-3:** if durable storage of extended validation metrics is later required, that is a **future versioned schema decision** — not part of D14.

**Validation dashboard architecture (24):**
- A **read-only view contract** (`ValidationReport`) that a dashboard consumes. **No API/UI is implemented here** (consistent with the project's no-UI scope; D9 is owner-gated).
- The dashboard data contract exposes: headline metrics (10–16), the breakdown tables (17–20), the equity/drawdown curve series, the gate status (§6), and data-quality flags (e.g., regime-attribution coverage %, R-basis status).
- Refresh is on-demand/periodic via the read-only worker; values are recomputed from PostgreSQL (Redis may cache, non-authoritative).

---

## 6. Approval Gates (requirements 25–28)

All thresholds/durations are **governance configuration** (owner-set), evaluated read-only against the `ValidationReport`. They gate **IBKR eligibility only** (forward-only, per `B9_OWNER_POLICY_UPDATE`); they never alter trading behavior.

### 25 — Minimum performance thresholds (IBKR eligibility) — *framework; values are owner decisions (OD-D14-4)*
A candidate framework (recommended placeholders; owner sets final numbers):
- **Minimum sample size:** ≥ N closed trades (statistical significance) — *recommend a meaningful minimum, e.g. ≥ 100*.
- **Win Rate:** ≥ floor (e.g. ≥ 45%).
- **Profit Factor:** ≥ 1.3.
- **Maximum Drawdown:** ≤ ceiling (e.g. ≥ −15% not breached), and **never** breached the D4 daily/weekly drawdown limits during paper.
- **Portfolio Return:** > 0 over the window.
- **Recovery:** worst drawdown recovered within a bounded number of trades/days.
- **Score-band monotonicity (sanity):** higher bands not materially underperforming lower bands.
- **Integrity:** zero unresolved DLQ items attributable to execution; no kill-switch L3/L4 caused by system error.

### 26 — Validation duration requirements (OD-D14-5)
Eligibility requires **all** of:
- **Minimum calendar duration** (e.g. ≥ a defined number of trading weeks/months).
- **Minimum trade count** (the sample-size floor above).
- **Regime coverage** — paper period spans at least Bull and one non-Bull regime (so performance isn't regime-lucky), to the extent regime data is available.

### 27 — Failure criteria
Validation **fails** (IBKR remains ineligible) if any holds:
- Threshold(s) in §25 not met at the end of the required duration.
- A D4 risk limit (daily/weekly drawdown, consecutive-loss, max-open/trades) was breached due to a **system defect** (not normal strategy behavior).
- Kill-switch reached L3/L4 due to a system/integrity error during paper.
- Reconciliation/integrity errors or unresolved execution DLQ items.
- Data-quality below a minimum (e.g., score-band/sector attribution coverage too low to trust the metrics).

### 28 — Rollback criteria
- **During validation:** on a failure-criteria trigger, **halt the validation clock** and revert to **Signals Only** (forward-only mode change, OD-9), pending owner review; the paper data and history are **never recalculated**.
- **Post-eligibility (future, when live is enabled under D13):** if live materially underperforms the paper baseline beyond a defined tolerance, **roll back** the execution target from IBKR-live → IBKR-paper (or Signals Only) — a forward-only mode change; historical records preserved.
- Rollback is an **operational/governance action** (mode selection + owner sign-off); it changes no strategy/risk/execution rule.

---

## 7. Preserved D1–D13 Invariants

| Invariant | How D14 preserves it |
|-----------|----------------------|
| PostgreSQL sole source of truth | Metrics computed read-only from persisted rows; reports reproducible. |
| Redis non-authoritative | Only an optional cache for dashboard data. |
| Score Engine authoritative | D14 reads scores; never scores. |
| Portfolio ⟂ Risk ⟂ Execution | Observational analytics; gates eligibility, not trades. |
| No strategy/risk/execution/capital-recovery/allocation change | Reuses D6 formulas; changes none. |
| No new tables/enums/schema | Reuses `performance_records` for core stats; extended metrics computed/exported, not persisted. |
| No D1–D13 modification | Additive read-only analytics/reporting layer. |
| Governance consistency | Thresholds/duration/rollback are forward-only governance; history never recalculated. |

---

## 8. Dependencies

**D14 depends on:** D1 (models/enums), D2 (DAL — read), D6 (`PnLCalculator`, `StatisticsCalculator`, `EquityTracker` — reuse), B8 (reporting worker, metrics, `system_events`), D11 (Paper target produces the data). It **feeds** the D13 IBKR gate.
**D14 does not depend on:** any broker, IBKR connectivity, TradingView, or a UI (the dashboard is a read-only contract, not implemented here).
**No new third-party dependency.**

---

## 9. Assumptions & Honest Gaps

1. **D14 is a read-only analytics/reporting/gate layer** (additive); it modifies no prior phase and adds no schema.
2. **Paper data source = D11 `PaperTarget`** (`broker_ref="paper:"`). The same framework will apply to **IBKR-paper** once D13 is built (target-agnostic), but D14 requires no IBKR.
3. **R-multiple has no native basis in v1** (no stop-loss/risk amount persisted; fixed allocation, no risk-based sizing — V2-001). True R-multiple is **not computable** from existing data → **OD-D14-1** (define a proxy, e.g., PnL normalized by average loss or a configured nominal risk, **or** defer the metric until a risk basis is persisted via a future versioned schema change).
4. **Regime attribution depends on the signal→market_snapshot linkage**; where unavailable, trades bucket as "unknown" and a coverage % is reported (**OD-D14-2**).
5. **Extended metrics are computed/exported, not persisted** (no new table); durable storage is a future versioned decision (**OD-D14-3**).
6. **Thresholds, duration, and rollback tolerances are owner governance** (**OD-D14-4/5**); the framework provides recommended placeholders, not final numbers.
7. **Forward-only governance**: validation outcomes and rollbacks never recalculate historical positions/PnL/audit/performance records (`B9_OWNER_POLICY_UPDATE`).

---

## 10. Owner Decisions Required

| # | Decision | Recommended |
|---|----------|-------------|
| **OD-D14-1** | R-multiple basis (no stop persisted) | Use a documented **proxy** (PnL ÷ average absolute losing-trade PnL) **or defer** true R until a risk basis is persisted (future schema). Recommend **proxy + clearly labeled**, defer true-R to V2. |
| **OD-D14-2** | Regime attribution when linkage missing | Bucket "unknown" + report coverage %; require minimum coverage for a valid regime gate. |
| **OD-D14-3** | Persist extended validation metrics? | **No** (compute/export read-only) now; durable store only via future versioned schema. |
| **OD-D14-4** | Eligibility threshold values | Owner sets final numbers; framework provides placeholders. |
| **OD-D14-5** | Validation duration + sample size + regime coverage | Owner sets; recommend meaningful minimums (e.g., ≥ a defined weeks + ≥ N trades + ≥ 2 regimes). |
| **OD-D14-6** | Dashboard surface | Read-only contract now; actual UI is D9 (owner-gated). |

---

## 11. Definition of Done

1. Read-only **metric calculators** (10–20) defined over existing data, **reusing D6** (PnL/stats/equity/drawdown) with no formula change.
2. **Period reports** (daily/weekly/monthly) via existing `performance_records` for core stats; **extended metrics** computed/exported (no new table).
3. **`ValidationReport`** read-only contract defined (headline metrics + breakdowns + equity/drawdown series + gate status + data-quality flags) for the dashboard.
4. **Approval gates** (25–28) defined as governance config: thresholds, duration/sample/regime coverage, failure criteria, rollback criteria — all forward-only, history-preserving.
5. **Invariants preserved**: PostgreSQL truth · Redis non-authoritative · Portfolio ⟂ Risk ⟂ Execution · no strategy/risk/execution/capital-recovery/allocation change · no new tables/enums/schema · no D1–D13 modification.
6. **Honest gaps surfaced** (R-basis, regime coverage) with owner decisions, not silently assumed.
7. Feeds the **D13 IBKR eligibility gate** (paper → live remains owner-gated + versioned).
8. `D14_BUILD_REPORT.md` produced at the future build gate; this document stops at architecture.

---

## 12. Stop Gate

**STOP.**

Architecture only — no code, no implementation, no tests, no source/schema changes, no modification to D1–D13. Await owner review and rulings on **OD-D14-1…OD-D14-6** (notably the R-multiple basis and the eligibility thresholds/duration) before any D14 implementation begins. Live broker deployment (D13) remains gated behind a **passing** paper-validation period and explicit versioned approval.
