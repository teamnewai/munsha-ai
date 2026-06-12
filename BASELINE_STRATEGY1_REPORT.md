# BASELINE_STRATEGY1_REPORT

**Subject:** Strategy 1 (baseline THUL-NURAYN) executed **exactly as implemented** — no modifications, no quality gate, no Core-exit enhancement, no parameter changes, no optimization.
**Environment:** PostgreSQL-backed (`PostgresDataAccessLayer`), deterministic OR-2 campaign fixture, Paper execution target, full autonomous pipeline (P-DATA → D3 → D4 → P-SIZE → D11/D5 → D6 → exit leg → D14).
**Capital:** $100,000 · per-trade allocation 10%.

---

## 1. Pre-run verification (Tasks 1–3)

| Check | Result |
|---|---|
| **Strategy 1 production-runnable** | ✅ Full suite **487 passed · 0 skipped · 0 failed** (with `DATABASE_URL` set — all DB-gated tests run) |
| **PostgreSQL health** | ✅ `pg_isready` → accepting connections (cluster `16/main`, port 5432) |
| **Schema** | ✅ 19 base tables applied |
| **Partitions** | ✅ 6 partitioned parents + 30 monthly child partitions (2026-01,02,03,06,07 × 6 tables) |
| **Seed data** | ✅ users=1 (operator), sectors=5, instruments=5 |
| **Scheduler / Orchestrator / Execution target** | ✅ verified via passing `test_orchestrator`, `test_run` (OR-1 compose/start/shutdown), `test_e2e_pipeline` (PG-backed), and the live campaign (90 cycles); targets = `signals` (default) + `paper` (campaign); `ibkr`/`tradingview` correctly not-implemented |
| **Campaign run** | ✅ 90 cycles completed against PostgreSQL; 225 closed round-trips persisted |

---

## 2. Headline performance

| Metric | Value |
|---|---|
| **Return** | **+15.43%** (ending equity $115,427.80) |
| **Profit Factor** | **1.75** (gross profit $36,082.20 / gross loss $20,654.40) |
| **Win Rate** | **60.0%** |
| **Max Drawdown** | **−3.34%** |
| **Recovery** | **Recovered = True** (equity curve returned to a new high-water mark) |
| **Number of Trades** | **225** (135 wins, 90 losses) |
| **Average Winner** | **+$267.28** |
| **Average Loser** | **−$229.49** |
| Campaign duration | 44 span-days / 45 active trading days |
| Regime coverage | Bull + Bear |

Average-win/average-loss ratio ≈ **1.16** (winners modestly larger than losers).

---

## 3. Long vs Short performance

| Direction | Trades | Win Rate | Net PnL | Profit Factor |
|---|---|---|---|---|
| **Long** | 115 | 60.0% | **+$7,465.80** | 1.70 |
| **Short** | 110 | 60.0% | **+$7,962.00** | 1.80 |

Both directions are profitable and broadly symmetric; Short is marginally stronger on this fixture.

---

## 4. Sector performance

| Sector | Trades | Win Rate | Net PnL | Profit Factor |
|---|---|---|---|---|
| Semiconductors (NVDA) | 45 | 100% | +$12,100.00 | ∞ (no losses) |
| ConsumerDisc (AMZN) | 45 | 100% | +$11,954.80 | ∞ (no losses) |
| AutoEV (TSLA) | 45 | 100% | +$12,027.40 | ∞ (no losses) |
| Hardware (AAPL) | 45 | 0% | −$10,296.00 | 0.0 |
| Software (MSFT) | 45 | 0% | −$10,358.40 | 0.0 |

> **Transparency note:** the all-win / all-loss split by sector is a **deterministic-fixture artifact**, not a strategy property. The OR-2 fixture assigns a fixed win/loss outcome per day-slot, and each slot maps to a fixed symbol→sector; so a given symbol is always a winner or always a loser. This is expected for a synthetic deterministic dataset and does not reflect real per-sector edge.

---

## 5. Validation-policy outcome (context)

Measured against the approved validation gate (governance config):

| Criterion | Threshold | Measured | Result |
|---|---|---|---|
| Duration | ≥ 30 days | 44 | ✅ PASS |
| Trades | ≥ 200 | 225 | ✅ PASS |
| Win Rate | ≥ 85% | 60.0% | ❌ FAIL |
| Profit Factor | ≥ 2.0 | 1.75 | ❌ FAIL |
| Max Drawdown | ≤ 10% | −3.34% | ✅ PASS |
| Positive Return | > 0 | +15.43% | ✅ PASS |
| Recovery | required | True | ✅ PASS |
| Regimes | ≥ 2 | Bull, Bear | ✅ PASS |
| Long & Short | both | yes | ✅ PASS |

**Overall gate: FAIL** — on win-rate (60% vs 85%) and profit-factor (1.75 vs 2.0). This is the expected result of the **deterministic fixture, which was designed to yield ~60% win rate** (not to satisfy the demanding policy bar); it is **not** a proven limitation of the system. Structural, coverage, drawdown, recovery, and return criteria all pass. The full autonomous pipeline and the PostgreSQL deployment are confirmed healthy and production-runnable.

---

## 6. Summary

Strategy 1, run exactly as implemented on the PostgreSQL-backed environment, produced a **profitable, recovered, low-drawdown** campaign: **+15.43% return, PF 1.75, 60% win rate, −3.34% max drawdown, 225 trades, both directions profitable.** It does not meet the 85% WR / 2.0 PF governance bar on this synthetic fixture (by fixture design). No logic was modified.

---

**STOP — baseline report complete. Strategy 2 remains paused. No new logic implemented. Awaiting owner approval.**
