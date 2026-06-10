# P-DATA_BUILD_REPORT

**Phase executed:** P-DATA — Market-data & mark-ingestion layer (Phase 2). **Replay/Fixture provider first.**
**Authorization:** P-SIZE approved/closed (`e60ca14`); gate to P-DATA opened. Build P-DATA only.
**Implemented exactly per:** `P_DATA_MARKET_DATA_ARCHITECTURE.md`.
**Result:** ✅ Complete. **357 passed · 24 skipped** (338 prior + **19 new P-DATA tests**). Lint clean (ruff + flake8); marketdata package mypy-clean.
**Footprint:** purely additive — new `src/app/marketdata/` package + `tests/test_marketdata.py`. **No frozen file modified** (D1–D14A, P-SIZE, existing `src/app/*`; diff empty).

---

## 1. Files Created (all new)

| File | Purpose |
|------|---------|
| `src/app/marketdata/__init__.py` | Package exports |
| `src/app/marketdata/frame.py` | `MarketDataFrame`, `QualityReport`, 5 data-quality issue constants |
| `src/app/marketdata/provider.py` | `MarketDataProvider` ABC (provider-independent seam) |
| `src/app/marketdata/replay.py` | `ReplayMarketDataProvider` — deterministic fixture replay → D3 DTOs + marks |
| `src/app/marketdata/quality.py` | `validate_frame` — the 5 data-quality failure checks |
| `src/app/marketdata/worker.py` | `MarketDataRefreshWorker` (B8 `Worker`) — publishes latest frame; alert+DLQ on fatal |
| `tests/test_marketdata.py` | 19 P-DATA tests |

No existing source/test/schema file modified.

## 2. Requirement Compliance (owner P-DATA requirements)

| Requirement | Status |
|-------------|--------|
| 1. Follow approved P-DATA architecture exactly | ✅ provider→frame→quality→worker per arch §3–§11 |
| 2. Replay/Fixture provider first | ✅ `ReplayMarketDataProvider`; no other provider built |
| 3. No live market-data provider | ✅ none; live vendor deferred behind the ABC |
| 4–6. No broker / TradingView / IBKR connectivity | ✅ none (test-asserted: no vendor/socket/engine imports) |
| 7. Preserve D1–D14A invariants | ✅ produces D3 DTOs only; no engine calls; no schema |
| 8. Preserve P-SIZE behavior | ✅ P-SIZE untouched (diff empty) |
| 9. PostgreSQL source of truth | ✅ P-DATA writes no domain rows; marks cache is non-authoritative Redis (optional) |
| 10. Portfolio ⟂ Risk ⟂ Execution | ✅ decision-free data layer; makes no D3/D4/D5/D6 call |
| 11. No architecture changes | ✅ implements approved architecture |
| 12. No schema changes | ✅ none (MarketSnapshot persistence deferred to P-ORCH; see §4) |

## 3. Design (as implemented)

- **`MarketDataProvider` ABC** — `poll() -> MarketDataFrame`, `exhausted() -> bool`. Vendor-independent seam (like D5 `BrokerSyncContract`). Live adapter is a future implementation behind it.
- **`ReplayMarketDataProvider`** — deterministic, network-free; replays an ordered sequence of fixture specs; parses pre-computed fact values into the **exact frozen D3 DTOs** (`MarketFacts`, `CoreCandidateInput` w/ `BreakoutFacts`/`EarningsFacts`, `TurboCandidateInput`); tracks `bar_id` for duplicate detection. (Live indicator `FactsBuilder` deferred — documented.)
- **`MarketDataFrame`** — transient: `{captured_at, market_open, market_facts?, core_candidates, turbo_candidates, marks{symbol→Decimal}, quality, bar_id}`; `tradable` = quality-valid ∧ market-open ∧ facts present.
- **Data-quality (`validate_frame`)** — the **five** failure types: **Missing Price · Invalid Volume · Duplicate Bar · Stale Data · Market Closed**. Fatal (frame-level) issues set `valid=False` and **withhold `market_facts`** (no fabricated facts) so P-ORCH will Reject Cycle; per-candidate issues (missing mark / invalid volume) drop only that candidate.
- **`MarketDataRefreshWorker`** (B8 `Worker`) — `run_once()` polls the provider, publishes `last_frame`, optionally caches marks in Redis (non-authoritative), and on a fatal frame records a `GatewayEvent` alert + DLQ entry (existing members) and continues. **Makes no engine calls.**

## 4. Assumptions

1. **Additive package** `src/app/marketdata/`; no existing file modified; B9/P-SIZE untouched.
2. **Marks keyed by symbol** (matching candidate symbols); **symbol→instrument_id resolution and MarketSnapshot persistence are P-ORCH's responsibility** (the DB/engine-owning layer) — consistent with arch §10 "P-DATA produces inputs only; makes no engine calls." No DB write here → no schema concern.
3. **Replay/Fixture provider emits pre-computed facts** (fastest path); the **live indicator `FactsBuilder` is deferred** behind the provider ABC (future, owner-gated).
4. **Fatal data-quality → frame withheld/invalid** (P-DATA signals; P-ORCH enforces the cycle-level Reject per its §4).
5. **Redis marks cache is optional and non-authoritative**; failures ignored; PostgreSQL remains source of truth.
6. **Quality validation rejects non-finite/≤0 prices** (reuses the same finiteness discipline as the P-SIZE hardening).

## 5. Remaining Risks

- **R1 (Low):** Fact-parity with D3 for the *live* FactsBuilder is deferred; the fixture provider emits valid DTOs but the live indicator computation (RS/RVOL/ATR/etc.) remains a future build behind the ABC (arch OD; not in this scope).
- **R2 (Low):** MarketSnapshot persistence (regime) is intentionally deferred to P-ORCH (needs D3 regime classification); P-DATA stays decision-free.
- **R3 (Info):** Marks symbol-keyed; instrument_id resolution at the P-ORCH boundary.
- None blocks P-ORCH; none affects frozen behavior.

## 6. Gate

**P-DATA is COMPLETE.** Phase 2 done. **P-ORCH NOT started.**
Accompanying: `P-DATA_ARCHITECTURE_COMPLIANCE_REPORT.md`, `P-DATA_TEST_RESULTS.md`.

**STOP — awaiting owner approval.**
