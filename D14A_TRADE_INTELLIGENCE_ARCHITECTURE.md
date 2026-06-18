# D14A_TRADE_INTELLIGENCE_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No implementation. No tests. No source changes. No schema changes.**
**Derived from:** approved B1–B9 / D10–D14 artifacts · `D14_PAPER_VALIDATION_ARCHITECTURE.md` · the owner-approved **Trade Intelligence Policy**, **Strategy Validation Policy**, **Profit Governance Policy** (`OWNER_PROFIT_POLICY.md`) · D3 Selection (`Score.breakdown`) · D6 Portfolio (calculators).
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** D14A — Trade Intelligence & Optimization-Recommendation layer (**recommendations only; no automatic changes**).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no strategy / risk / execution / allocation / capital-recovery / scoring changes** · no new tables · no new enums · no schema changes · **no modification to D1–D14** · **recommendations only — no automatic strategy/parameter/optimization changes** (Trade Intelligence Policy).

---

## 1. Purpose & Stance

D14A turns completed-trade history into **diagnostic intelligence** and **ranked optimization-recommendation candidates** for owner review. It answers *why* trades win or lose — never *changes* anything.

It is strictly a **read-only analytics + advisory layer**: it reads persisted trades, attributes factors (from `Score.breakdown` and joins), compares winners vs losers, produces period reports, and emits **recommendation candidates with estimated impact and confidence**. It performs **zero** automatic strategy, risk, execution, allocation, recovery, parameter, or optimization changes (Trade Intelligence Policy; D14A requirements 11–16). Applying any recommendation is a separate, owner-gated, versioned architecture review.

**Relationship to D14:** D14 = pass/fail **eligibility gates** (now with the owner's concrete thresholds — §11). D14A = **diagnostic intelligence + recommendations**. D14A **reuses** D14's per-trade assembly and D6 calculators; it adds no formula.

---

## 2. Core Principles (requirements 1, 8, 11–16)

| # | Requirement | Commitment |
|---|-------------|------------|
| 1 | Preserve D1–D14 invariants | Additive read-only layer; PostgreSQL truth; separation intact; no schema change. |
| 8 | Recommendation **candidates only** | Output is advisory artifacts ranked by confidence; nothing is applied. |
| 11 | No automatic changes | D14A writes no domain rows and changes no config/parameters. |
| 12 | No strategy modification | D3 untouched; D14A only *describes* factor associations. |
| 13 | No risk modification | D4 untouched. |
| 14 | No execution modification | D5 untouched. |
| 15 | No allocation modification | fixed allocation (V2-001) untouched. |
| 16 | No recovery modification | B9/D6 recovery untouched. |

**Human-in-the-loop guarantee:** recommendation → owner review → (if accepted) formal architecture review + versioned approval → implementation. No feedback loop from D14A into the engine.

---

## 3. Data Sources (existing; read-only)

| Source | Used for |
|--------|----------|
| `positions` (entry/exit/direction/engine/instrument, opened_at/closed_at) | outcome, PnL, direction, timing |
| `orders` (`signal_id`, `broker_ref`, created_at) | trade↔signal linkage; paper tagging |
| `fills` | execution confirmation, fill price/time |
| `scores` (`classification`, `total`, **`breakdown` JSONB**) | classification + factor contributions (RS/RVOL/Gap/PEAD/…) |
| `signals` (created_at, engine, direction) | entry timing, engine |
| `instruments` (`sector_id`, `market`) | sector |
| `market_snapshots` (`regime`) + `scanner_results` (`market_snapshot_id`, `rvol`) | regime attribution; raw RVOL |
| `performance_records` | period stats (reuse) |
| `system_events` / DLQ | integrity context |

**Factor → persisted source (confirmed):**
- **RS** → `scores.breakdown["relative_strength"]` (Core)
- **RVOL** → `scores.breakdown["rvol"]` (Core/Turbo) + `scanner_results.rvol` (raw)
- **Gap** → `scores.breakdown["gap_catalyst"]` (Turbo)
- **PEAD** → `scores.breakdown["pead"]` (Core)
- (also available: `breakout`, `trend`, `regime` weight, `vwap_bias`, `orb`, `momentum`)
- **Classification** → `scores.classification`; **Sector** → `instruments.sector_id`; **Long/Short** → `positions.direction`; **Regime** → `market_snapshots.regime` (via linkage, coverage-reported); **Entry/Exit timing** → `orders.created_at`/`positions.opened_at` / `positions.closed_at`.

**Trade↔score join:** `position → orders_for_position → order.signal_id → score_for_signal` (existing D2 structural lookups; read-only). **D6 reuse:** `PnLCalculator` (per-trade PnL), `StatisticsCalculator` (win/loss, win = PnL > 0), `EquityTracker` (drawdown) — no formula duplicated.

---

## 4. Per-Trade Intelligence Record (requirement 2)

For **every completed (closed) trade**, D14A assembles a transient, read-only **feature record** (not persisted; not a new entity):

```
TradeRecord {
  position_id, signal_id, instrument_id, engine, direction,
  outcome: win|loss (PnL > 0),  realized_pnl,  r_proxy (D14 OD-D14-1),
  classification,  score_total,
  factors: { relative_strength, breakout, rvol, trend, pead,         # Core
             vwap_bias, gap_catalyst, orb, momentum },               # Turbo (as applicable)
  rvol_raw (scanner_results),
  sector_id,  regime (or "unknown"),
  entry_time, exit_time, holding_period,  entry_tod, exit_tod, dow,
  paper|live tag (broker_ref convention),
  data_quality_flags { regime_attributed, breakdown_present, ... }
}
```

Every trade is analyzed **individually** (requirement 2) and then aggregated. Records are deterministic and reproducible from source rows.

---

## 5. Winners vs Losers Analysis (requirements 3–6)

**Comparison (3):** split TradeRecords by outcome; for each factor, compute the **winner distribution vs loser distribution**, win-rate and profit-factor by factor bucket, and the **separation/lift** between groups — using **transparent statistics only** (no black-box ML in v1, OD-D14A-7).

**Factor strength (4, 5):**
- **Strongest positive factors** — factor buckets with the highest win-rate/PF lift and PnL contribution among winners.
- **Strongest negative factors** — buckets most associated with losses (win-rate drag, negative PnL contribution).
- Each factor finding carries **sample size** and an **effect measure** (e.g., win-rate delta, profit-factor by bucket) with an uncertainty indicator — to prevent over-reading small samples.

**Factor dimensions analyzed (6):**

| Factor | Method | Source / caveat |
|--------|--------|-----------------|
| Sector | win-rate/PF/PnL per `sector_id` | instruments |
| Market Regime | per `regime` (Bull/Bear/Sideways) | linkage coverage-reported |
| Classification | per band (UltraGolden→Watchlist) | sanity: bands should be monotone |
| Long/Short | per `direction` | positions |
| RS | outcome vs `relative_strength` contribution buckets | Core breakdown |
| RVOL | outcome vs `rvol` contribution + raw RVOL buckets | breakdown + scanner_results |
| Gap | outcome vs `gap_catalyst` buckets | Turbo breakdown |
| PEAD | outcome vs `pead` buckets | Core breakdown |
| Entry Timing | win-rate by time-of-day / day-of-week / regime-at-entry | orders/signals/positions |
| Exit Timing | win-rate & PnL by holding-period / exit time-of-day | positions; **counterfactual "optimal exit" limited** (no post-exit prices persisted) — descriptive only (OD-D14A-4) |

All analysis is **association, not causation**, and is explicitly labeled as such (§7 honesty).

---

## 6. Reports (requirement 7)

Read-only intelligence reports produced by a B8-style worker:
- **Daily · Weekly · Monthly · Cumulative** intelligence reports.
- **Core period stats** reuse the existing `performance_records` (D6); **intelligence content** (winner/loser factor analysis, positive/negative drivers, breakdowns, recommendation candidates) is **computed and exported** as report artifacts (JSON/markdown) — **not** persisted as new entities (no new table). Fully reproducible from source.
- A read-only **report contract** (`TradeIntelligenceReport`) that a future dashboard (D9, owner-gated) may consume — **no UI implemented here**.

> OD-D14A-5: durable storage of intelligence reports/recommendations is a **future versioned schema decision**; v1 computes/exports read-only.

---

## 7. Recommendation Candidates (requirements 8–10)

Each recommendation is an **advisory candidate**, never an applied change.

**Candidate structure:**
```
RecommendationCandidate {
  id, scope (e.g. "RVOL threshold", "regime filter", "sector exposure review"),
  observation,                 # the factor finding (winners vs losers)
  evidence { sample_size, win_rate_delta, pf_by_bucket, period_stability },
  estimated_impact,            # BACKWARD-LOOKING estimate on the analyzed sample
  confidence_score,            # ranked (requirement 10)
  caveats,                     # overfitting / coverage / causation warnings
  proposed_next_step           # "owner review -> architecture review -> versioned approval"
}
```

**Estimate expected impact (9):** a **backward-looking** estimate of how the historical sample's win-rate/profit-factor would differ under the suggested lens (e.g., "trades with RVOL contribution in the bottom quartile had win-rate X% vs Y%"). Explicitly labeled **descriptive of past data, not a forward guarantee**; the engine is **not** re-simulated as if changed (that would be optimization — forbidden).

**Rank by confidence (10):** confidence combines **sample size**, **effect size**, and **cross-period/cross-regime stability** (a transparent, documented formula — OD-D14A-3). Low-sample or unstable findings rank low and are flagged.

**Hard constraint:** candidates are **hypotheses for the owner**. D14A applies none, tunes nothing, and runs no optimization loop (requirements 11–16; Trade Intelligence Policy). Adopting a candidate is a separate strategy change → frozen → formal architecture review + versioned approval.

---

## 8. Honesty, Limits & Anti-Overfitting

- **Association ≠ causation** — every finding is correlational over historical paper data.
- **Overfitting risk** — many factors × limited trades can manufacture spurious patterns; confidence scoring + minimum sample sizes + cross-period stability requirements mitigate this; weak findings are surfaced as such, not hidden.
- **Coverage caveats** — regime attribution and `breakdown` presence are **coverage-reported**; recommendations below a coverage floor are flagged/withheld (OD-D14A-2).
- **R-multiple** uses the D14 proxy (no native risk basis in v1; OD-D14-1) — clearly labeled.
- **Exit-timing optimality** is **not** computed (no post-exit price series persisted); only descriptive holding-period/time-of-day analysis (OD-D14A-4).
- **No ML auto-tuning** in v1 (transparent statistics only); ML-based optimization is a future versioned decision (OD-D14A-7).
- **IP protection** — internal intelligence reports may include component analysis (owner's own data); **external publication never exposes the scoring formula** (consistent with D12/D14).

---

## 9. Preserved D1–D14 Invariants

| Invariant | How D14A preserves it |
|-----------|----------------------|
| PostgreSQL sole source of truth | All intelligence derived read-only from persisted rows; reproducible. |
| Redis non-authoritative | Optional cache for report/dashboard data only. |
| Score Engine authoritative | D14A reads `scores`/`breakdown`; never scores. |
| Portfolio ⟂ Risk ⟂ Execution | Observational analytics; gates/changes nothing. |
| No strategy/risk/execution/allocation/recovery/scoring change | Reuses D6 formulas; recommends only; applies nothing. |
| No new tables/enums/schema | Reuses `performance_records`; intelligence computed/exported. |
| No D1–D14 modification | Additive read-only layer. |
| No automatic optimization | Human-in-the-loop; recommendations advisory; owner-gated + versioned to adopt. |

---

## 10. Dependencies

**D14A depends on:** D1 (models/enums incl. `Score.breakdown`), D2 (DAL + structural lookups — read), D3 (scores/breakdown — read only), D6 (`PnLCalculator`/`StatisticsCalculator`/`EquityTracker` — reuse), D14 (per-trade assembly, R-proxy, validation context), B8 (reporting worker, metrics, `system_events`). It **informs** the owner; it feeds no engine.
**D14A does not depend on:** broker/IBKR, TradingView, or a UI (the report/dashboard is a read-only contract, not implemented).
**No new third-party dependency** (no ML libs in v1).

---

## 11. Context: Approved Governance (recorded)

The owner-approved policies now in force (referenced, not re-litigated here):
- **Strategy Validation Policy** — concrete gates (these **supersede the D14 placeholders**, D14 OD-D14-4/5):
  - **Paper PASS:** 30 days · 200 trades · Win Rate ≥ 85% · Profit Factor ≥ 2.0 · Max Drawdown ≤ 10% · positive return · recovery required · 2+ regimes · long & short tested.
  - **Live approval:** 30 days · 200 trades · Win Rate ≥ 95% · Profit Factor ≥ 3.0 · Max Drawdown ≤ 5% · positive return · recovery required · 2+ regimes · long & short tested.
- **Trade Intelligence Policy** — analyze every trade; winners vs losers; recommendations only; **no automatic strategy/parameter/optimization changes** (this document's mandate).
- **Profit Governance Policy** — no fixed-profit forced exit; winners may run under trailing-stop/approved exits; profit % reporting only; partial-profit-taking deferred (`OWNER_PROFIT_POLICY.md`).

D14A enforces the Trade Intelligence Policy's "recommendations only" rule throughout and uses the validation thresholds only as **reporting context** (it does not gate or trade).

---

## 12. Owner Decisions Required

| # | Decision | Recommended |
|---|----------|-------------|
| **OD-D14A-1** | R-multiple basis | Reuse D14 proxy (PnL ÷ avg absolute loss), clearly labeled; true-R deferred (no risk basis persisted). |
| **OD-D14A-2** | Minimum factor/coverage to issue a recommendation | Set a sample-size floor + coverage floor; below it, flag/withhold. |
| **OD-D14A-3** | Confidence scoring formula | Transparent: sample size × effect size × cross-period stability; documented, no black box. |
| **OD-D14A-4** | Exit-timing analysis scope | **Descriptive only** in v1 (no post-exit price data); counterfactual exit analysis deferred. |
| **OD-D14A-5** | Persist intelligence reports/recommendations? | **No** (compute/export) now; durable store via future versioned schema. |
| **OD-D14A-6** | Recommendation governance workflow | Advisory → owner review → architecture review → versioned approval; never auto-applied. |
| **OD-D14A-7** | Analysis method | Transparent statistics now; **ML/auto-optimization deferred** (future versioned). |

---

## 13. Definition of Done (requirement 17)

1. Read-only **per-trade intelligence record** assembled for **every completed trade** (requirement 2), reusing D14 assembly + D6 calculators.
2. **Winners-vs-losers** comparison (3) producing **strongest positive** (4) and **strongest negative** (5) factors with sample size + effect + uncertainty.
3. **Factor analysis** across all dimensions (6): Sector, Regime, Classification, Long/Short, RS, RVOL, Gap, PEAD, Entry Timing, Exit Timing — from `Score.breakdown` + joins, coverage-reported.
4. **Reports** (7): daily/weekly/monthly/**cumulative**; core stats via existing `performance_records`; intelligence content computed/exported (no new table); read-only report contract for a future dashboard.
5. **Recommendation candidates only** (8) with **estimated impact** (9, backward-looking, labeled) and **confidence ranking** (10).
6. **No automatic changes** (11) and **no modification** to strategy/risk/execution/allocation/recovery/scoring (12–16) — verified by design (read-only; writes nothing to domain/config).
7. **Honesty controls**: association-not-causation, anti-overfitting (min samples, stability), coverage flags, R-proxy labeling, exit-timing limits.
8. **Invariants preserved**; recommendations are **owner-gated + versioned** to adopt; no feedback loop into the engine.
9. (Future build) tests cover: per-trade assembly, win/loss split, factor attribution from breakdown, coverage handling, confidence ranking, report generation, and a guarantee of **zero domain/config writes**.
10. `D14A_BUILD_REPORT.md` produced at the future build gate; this document stops at architecture.

---

## 14. Stop Gate (requirement 18)

**STOP.**

Architecture only — no code, no implementation, no tests, no source/schema changes, no modification to D1–D14, and **no automatic strategy/parameter/optimization changes** (recommendations only, per the Trade Intelligence Policy). Await owner review and rulings on **OD-D14A-1…OD-D14A-7** before any D14A implementation begins. Adopting any recommendation remains a separate, owner-gated, versioned architecture review.
