# P_DATA_MARKET_DATA_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No implementation. No tests. No source changes. No schema changes.**
**Derived from:** approved B1–B9 / D10–D14A artifacts · D3 `facts.py` (the input contracts) · D6 (marks/snapshot) · B7 (persistence) · B8 (scheduler/DLQ/alerting) · B9 (bootstrap/recovery) · the project status audit.
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** P-DATA — Market-data & mark-ingestion layer (the critical input layer for the first autonomous paper-trading run; feeds the separate P-ORCH orchestrator).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no strategy / risk / execution / allocation / capital-recovery / scoring changes** · no new tables · no new enums · no schema changes · **no modification to D1–D14A**.

---

## 1. Purpose & Boundary

P-DATA acquires raw market data and **produces the passed-in facts that D3 already expects** — `MarketFacts`, `CoreCandidateInput`, `TurboCandidateInput` — plus a per-instrument **marks** map for paper fills (D11) and portfolio snapshots (D6). `facts.py` explicitly anticipates this layer ("Inputs are PASSED-IN facts (computed elsewhere — a data provider in a later phase)").

**Hard boundary (preserves Score-Engine-as-truth):**
- **P-DATA = market data → facts** (technical indicator *values*: SMA200, RS rating, RVOL, ATR, VWAP position, gap %, 52w/base context, PEAD context, regime inputs).
- **D3 = facts → score/selection** (all thresholds RS 80/90, RVOL 1.5/2.0/3.0, gap 4%, etc. **stay in D3**, unchanged).
- P-DATA **makes no selection/risk/scoring decision** and introduces **no new threshold**. It computes the spec-defined fact values the D3 input DTOs require, nothing more.

---

## 2. Layering (provider-independent)

```
┌──────────────────────────────────────────────────────────────────────┐
│ MarketDataProvider (ABC — provider-independent, req 9)                 │
│   raw bars / quotes / fundamentals / corporate-actions                 │
│   impls: Mock/Replay (first paper run) · LiveVendorAdapter (future)    │
└───────────────┬────────────────────────────────────────────────────────┘
                │ raw data
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FactsBuilder (indicator computation — spec-defined facts only)         │
│   SMA200/SPY → MarketFacts · RS/RVOL/ADV/trend/52w/PEAD → CoreInput     │
│   RVOL/ATR/premkt/gap/VWAP/ORB/momentum → TurboInput · price → marks    │
└───────────────┬────────────────────────────────────────────────────────┘
                │ MarketDataFrame {market_facts, core[], turbo[], marks{}, quality}
                ├─► persist MarketSnapshot (regime/SPY) ── existing table (durable)
                ├─► cache marks in Redis ── non-authoritative
                ▼
        P-ORCH (separate phase) each cycle → D3 SelectionEngine.run(...)
                                           → D4 → ExecutionTarget → D6
   Truth: PostgreSQL (market_snapshots; fills.price; positions entry/exit)
```

Three clean layers: **Provider** (raw I/O) ⟂ **FactsBuilder** (indicators) ⟂ **D3** (scoring). The provider is swappable (mock/replay → live vendor) with no change to FactsBuilder or D3.

---

## 3. Real-Time Market-Data Source Architecture (requirement 1)

- **`MarketDataProvider` ABC** (provider-independent, req 9): methods to fetch the latest bars/quotes for a symbol set, daily history (for SMA200/52w/ADV/ATR), pre-market volume, gap reference (prior close/open), and SPY series (regime). All return **raw** data — no facts, no decisions.
- **Implementations:**
  - **MockMarketDataProvider / ReplayProvider** — deterministic (recorded/CSV/synthetic) data for the **first paper run** and tests; no network. *(Recommended starting provider — OD-PDATA-2.)*
  - **LiveVendorAdapter (future, owner-gated)** — a real market-data vendor, introduced as a later additive swap behind the same ABC (vendor choice deferred — OD-PDATA-6). **Not implemented now.**
- **Cadence:** provider-paced; Core (swing) refreshes on a daily/EOD cycle, Turbo (intraday) on a minute-level cycle (OD-PDATA-5). The provider abstraction hides real-time vs replay timing.
- **Universe:** the tradable set is the existing `instruments` table (NASDAQ/NYSE, active); P-DATA requests data only for known active instruments and resolves `symbol → instrument_id` via the DAL. Unknown symbols are flagged, never auto-created (OD-PDATA-4).

---

## 4. Candidate Ingestion Architecture (requirement 2)

For each instrument in the active universe, FactsBuilder assembles the engine-specific candidate facts **exactly matching D3's frozen DTOs**:

- **Core (`CoreCandidateInput`):** `symbol`, `direction`, `rs_rating`, `rvol`, `adv`, `trend_stage2` (price > 50 > 150 > 200 SMA, SMA200 rising), `breakout` (`new_52w_high`, `base_breakout`, `base_days`), `earnings` (`surprise_positive`, `days_since`, `aligned`).
- **Turbo (`TurboCandidateInput`):** `symbol`, `direction`, `rvol`, `adv`, `atr`, `premarket_volume`, `gap_pct`, `above_vwap`, `catalyst`, `orb_confirmed`, `momentum_ok`.

P-DATA emits **candidate facts only**; D3 applies the eligibility thresholds and scoring. Candidates failing **data-quality** checks (§8) are dropped + dead-lettered, never passed to D3 with bad values. Direction (Long/Short) is derived per the spec's regime/engine rules at the fact level (Turbo Short in Bear, Core Long-only) — but the **gating** remains D3's.

> The exact fact *definitions* (e.g., what `trend_stage2` means) are spec-derived and must match D3's expectations; an architecture-verification step confirms parity (OD-PDATA-3 placement keeps this isolated and reviewable).

---

## 5. MarketFacts Production Flow (requirement 3)

1. Provider fetches the SPY series (price + history for SMA200) and optional ADX.
2. FactsBuilder computes `MarketFacts(spy_price, spy_sma_200, adx?)`.
3. P-ORCH passes `MarketFacts` to `SelectionEngine.run(...)`; **D3's RegimeEngine** (unchanged) classifies Bull/Bear/Sideways (SPY > SMA200×1.01 / < ×0.99 / band) — P-DATA does **not** classify regime, it only supplies the facts.
4. The resulting market state is **persisted as a `MarketSnapshot`** (existing table: `regime`, `spy_price`, `spy_sma_200`, `vix?`, `state?`) — durable, partition-routed (B7). **No schema change.**

---

## 6. Mark Price Generation & Persistence (requirement 4)

- **Mark = current price per instrument**, produced by the provider, keyed `marks: dict[instrument_id → Decimal]`.
- **Consumers:** P-ORCH supplies `intent.mark` to the D11 `PaperTarget` (fill price) and `marks` to D6 `PortfolioState.snapshot(marks)` (unrealized PnL).
- **Persistence model (freeze-respecting):**
  - **Marks are transient** by default — cached in **Redis (non-authoritative)** and supplied to engines per cycle.
  - **Durable price capture occurs naturally** where it matters: the paper fill price → `fills.price` (durable); position entry/exit → `positions.entry_price/exit_price` (durable); market-level price → `market_snapshots.spy_price`.
  - **No new `quotes`/`marks`/price-history table is introduced** (would be a schema change → V2 versioned decision). Missing marks are **excluded from unrealized PnL** (existing D6 fail-safe) — no fabricated prices.
- **OD-PDATA-1:** if a durable per-instrument price history is later required (e.g., for richer analytics), that is a **future versioned schema decision** — out of P-DATA scope.

---

## 7. Regime Data Ingestion (requirement 5)

- Inputs: SPY price + 200-day SMA (+ optional ADX/VIX) from the provider.
- Output: `MarketFacts` (§5) → D3 RegimeEngine classifies (unchanged) → persisted `MarketSnapshot` (regime + SPY + vix/state).
- Regime is therefore **durably recorded** every cycle (existing `market_snapshots`), which also closes the D14/D14A "regime attribution" coverage gap going forward (trades can be tied to the prevailing snapshot). P-DATA supplies facts; **D3 owns the regime rule**.

---

## 8. Data-Quality Validation (requirement 7)

Validated **before** any fact reaches D3 (fail-safe; never feed garbage to scoring/risk):
- **Raw checks:** non-null prices, positive volumes, sane ranges, monotonic/te fresh timestamps, sufficient history for SMA200/52w/ATR, `symbol` resolves to an active `Instrument`.
- **Freshness/staleness:** data older than a configured max age is **stale** → exclude + alert; trading on stale data is refused (OD-PDATA-7).
- **Derived-facts sanity:** RVOL/ADV/gap/ATR within plausible bounds; incomplete candidate facts → drop that candidate.
- **Outcome:** invalid raw/candidate data → **rejected + dead-lettered (B8 DLQ) + alert**; a **quality report** (coverage %, dropped count, staleness) accompanies each `MarketDataFrame` (consistent with D14/D14A coverage reporting). The market-level frame is withheld entirely if SPY/regime inputs fail (no regime → no new trades, matching the Sideways/no-trade fail-safe posture).

---

## 9. Failure Handling & Recovery (requirement 6)

| Condition | Response |
|-----------|----------|
| Provider unreachable / partial outage | Frame for affected symbols withheld; **alert + DLQ**; P-ORCH proceeds only on the valid subset; if SPY/regime missing → **no new trades** this cycle. |
| Stale data beyond max age | Treated as missing (excluded); alert; no trading on stale facts. |
| Bad/invalid data | Rejected + dead-lettered; never passed to D3. |
| Redis (mark cache) unavailable | DEGRADED; marks supplied directly from the latest frame; durable capture still occurs at fill. |
| PostgreSQL unreachable | Upstream B7/B9 fail-safe; market_snapshots not written; pipeline halts (PostgreSQL is truth). |
| **Restart** | B9 rebuilds positions/orders/portfolio from PostgreSQL (unchanged); **marks are cold** and re-acquired from the provider on the next cycle; missing marks excluded from unrealized PnL until refreshed. |
| No automatic retry | Consistent with the invariant: a failed *unit* is dead-lettered for manual handling; the **scheduled next-cycle re-fetch is normal cadence, not a retry of a dead-lettered unit**. |

Recovery is non-destructive; P-DATA never mutates domain rows and never fabricates prices.

---

## 10. Scheduler Interaction with P-ORCH (requirement 8)

- P-DATA runs as a **B8 scheduler worker** (`MarketDataRefreshWorker`) on the engine-appropriate cadence (Core EOD / Turbo intraday — OD-PDATA-5), reusing the existing `Scheduler`/`Worker` with per-worker failure isolation.
- Each refresh produces a transient **`MarketDataFrame`** = `{ market_facts, core_candidates[], turbo_candidates[], marks{}, quality_report, captured_at }` — a value object (not a persisted entity).
- **Handoff to P-ORCH (separate phase):** P-ORCH consumes the latest `MarketDataFrame` each trading cycle: `MarketFacts` + candidates → `SelectionEngine.run` → D4 → `ExecutionTarget.handle_accepted` (with `intent.mark` from `marks`) → D6 snapshot (with `marks`).
- P-DATA **produces inputs only**; it does **not** call D3/D4/D5/D6 itself (that is P-ORCH's role) — keeping the data layer decision-free and preserving separation. The P-DATA↔P-ORCH contract is the `MarketDataFrame`.

---

## 11. Source Abstraction (requirement 9)

- **`MarketDataProvider` ABC** isolates all vendor specifics (like `BrokerSyncContract` isolates brokers). FactsBuilder and D3 depend only on the ABC and the frozen `facts.py` DTOs.
- Swapping mock/replay → a live vendor is a **provider implementation change only** — no change to FactsBuilder, D3, or the schema.
- This keeps the **core market-data-vendor-independent** (analogous to TradingView/IBKR being optional plug-ins).

---

## 12. Preserved D1–D14A Invariants

| Invariant | How P-DATA preserves it |
|-----------|-------------------------|
| PostgreSQL sole source of truth | Regime via `market_snapshots`; prices durably captured at fill/entry/exit; marks only cached. |
| Redis non-authoritative | Mark cache only; degraded-safe. |
| Score Engine authoritative | P-DATA emits facts; **D3 scores**; no threshold/scoring logic in P-DATA. |
| Portfolio ⟂ Risk ⟂ Execution | P-DATA is decision-free; P-ORCH (separate) drives the engines. |
| No strategy/risk/execution/allocation/recovery/scoring change | Facts only; engines unchanged. |
| No new tables/enums/schema | Reuses `instruments`/`market_snapshots`/`fills`/`positions`; marks transient. |
| No D1–D14A modification | Additive provider + FactsBuilder + a B8 worker; no prior file changed. |
| Fail-safe; no auto-retry | Bad/stale/missing data excluded + dead-lettered; no fabricated prices. |
| No secrets in code/git/logs | Vendor credentials (future) via env/secret manager; redacted. |

---

## 13. Dependencies

**P-DATA depends on:** D1 (`Instrument`, `MarketSnapshot`, enums), D2 (DAL — resolve instruments, persist snapshots), D3 **input DTOs** (`MarketFacts`/`CoreCandidateInput`/`TurboCandidateInput` — produced, not modified), B7 (PostgresDAL, Redis client), B8 (scheduler/worker, DLQ, alerting). It **feeds P-ORCH**.
**P-DATA does not depend on:** any broker/IBKR/TradingView, or D4/D5/D6 directly (P-ORCH wires those).
**New (implementation-time, owner-gated) dependency:** a market-data client for the live provider — only when a `LiveVendorAdapter` is approved (OD-PDATA-6); the mock/replay provider needs none.

---

## 14. Assumptions

1. **P-DATA is the "data provider" `facts.py` anticipated**; producing facts is by-design, not a strategy change.
2. **Indicator computation ≠ strategy:** P-DATA computes spec-defined fact *values*; all thresholds/scoring remain in D3.
3. **Marks are transient** (Redis + per-cycle supply); durable price capture is at fill/entry/exit; **no new price table** (OD-PDATA-1).
4. **First paper run uses a Mock/Replay provider** (deterministic, no network); live vendor is a later additive swap (OD-PDATA-2/6).
5. **Universe = `instruments` table** (active NASDAQ/NYSE); unknown symbols flagged, never auto-created (OD-PDATA-4).
6. **Regime is classified by D3** from P-DATA's `MarketFacts`; P-DATA persists the resulting `MarketSnapshot`.
7. **P-ORCH (separate phase) consumes the `MarketDataFrame`**; P-DATA itself makes no engine calls.
8. **No auto-retry**; scheduled re-fetch is normal cadence, not retry of a dead-lettered unit.
9. **Fact-definition parity with D3** is verified at architecture/implementation review (the FactsBuilder must produce values consistent with D3's expectations).

---

## 15. Owner Decisions Required

| # | Decision | Recommended |
|---|----------|-------------|
| **OD-PDATA-1** | Mark persistence | **Transient (Redis + durable at fill/entry/exit)**; no new price table; durable history is a future versioned schema decision. |
| **OD-PDATA-2** | First-run provider | **Mock/Replay** (deterministic, no network) to validate the autonomous pipeline; live vendor later. |
| **OD-PDATA-3** | FactsBuilder/provider placement | New additive package (e.g. `src/marketdata/` or `src/app/marketdata/`); **must not modify D3** (it produces D3's inputs). |
| **OD-PDATA-4** | Universe source | **`instruments` table** (active) as the tradable universe; provider supplies data for those. |
| **OD-PDATA-5** | Refresh cadence | Core EOD/daily; Turbo intraday/minute; owner sets exact intervals. |
| **OD-PDATA-6** | Live market-data vendor | Defer to a later owner-gated decision behind the `MarketDataProvider` ABC. |
| **OD-PDATA-7** | Staleness policy | Define max data age; beyond it, exclude + alert + no trading on stale facts. |

---

## 16. Definition of Done

1. **`MarketDataProvider` ABC** (provider-independent) defined; **Mock/Replay** implementation specified for the first paper run; live vendor deferred behind the ABC.
2. **FactsBuilder** specified, producing D3's exact frozen DTOs (`MarketFacts`, `CoreCandidateInput`, `TurboCandidateInput`) and a **marks** map — computing spec-defined facts only, no thresholds/scoring.
3. **MarketFacts flow** → D3 RegimeEngine (unchanged) → **`MarketSnapshot` persisted** (existing table).
4. **Marks**: transient (Redis + per-cycle supply); durable at fill/entry/exit; no new table; missing marks excluded from unrealized PnL.
5. **Data-quality validation** + **staleness** gate; invalid/stale data excluded + dead-lettered; quality report per frame.
6. **Failure/recovery** specified: provider outage, stale, Redis/PostgreSQL down, restart (marks cold, domain rebuilt by B9); no auto-retry; no fabricated prices.
7. **B8 `MarketDataRefreshWorker`** producing a transient **`MarketDataFrame`**; **P-ORCH handoff contract** defined (P-DATA produces inputs only; makes no engine calls).
8. **Provider abstraction** keeps the core vendor-independent.
9. **Invariants preserved**: PostgreSQL truth · Redis non-authoritative · Score Engine authoritative · Portfolio ⟂ Risk ⟂ Execution · no strategy/risk/execution/allocation/recovery/scoring change · no new tables/enums/schema · no D1–D14A modification.
10. Owner decisions OD-PDATA-1…7 resolved; D3 fact-definition parity verified.
11. `P_DATA_BUILD_REPORT.md` produced at the future build gate; this document stops at architecture.

---

## 17. Stop Gate (requirement 10)

**STOP.**

Architecture only — no code, no implementation, no tests, no source/schema changes, no modification to D1–D14A. P-DATA produces facts/marks for **P-ORCH** (the next required phase); together they unblock the first autonomous paper-trading run. Await owner review and rulings on **OD-PDATA-1…OD-PDATA-7** before any P-DATA implementation begins, and before authoring **P-ORCH** (the orchestrator that consumes the `MarketDataFrame`).
