# NEUTRAL_AB_OR2_VALIDATION_REPORT

**Test:** Strategy 1 vs Strategy 2 — **fair, neutral A/B on the ORIGINAL OR-2 campaign fixture only.**
**Per owner constraints:** `comparison_fixture.py` was **not** used; **no** new fixture was created; **no** data was modified; **no** Core comparison scenarios were added. Both strategies ran the original `campaign_fixture.build_campaign()` (OR-2) only.
**Identical conditions:** same PostgreSQL environment, same capital ($100,000), same symbols (NVDA/AAPL/MSFT/AMZN/TSLA), same market regimes (Bull/Bear), same duration (45 days / 90 cycles), same deterministic clock. The **only** difference between the two runs is the orchestrator class (Strategy 1 = `PipelineOrchestrator`; Strategy 2 = `Strategy2Orchestrator`).
**Results below are actual measured PostgreSQL run output — no estimates, no projections.**

---

## 1. Headline metrics (measured)

| Metric | Strategy 1 | Strategy 2 | Difference |
|---|---|---|---|
| **Net Return** | **+15.43%** | **+15.43%** | **0.00** |
| **Profit Factor** | **1.7469** | **1.7469** | **0.00** |
| **Win Rate** | 60.0% | 60.0% | 0.00 |
| **Max Drawdown** | −3.34% | −3.34% | 0.00 |
| **Recovery** | Recovered (True) | Recovered (True) | equal |
| **Number of Trades** | 225 | 225 | 0 |
| **Average Winner** | +$267.28 | +$267.28 | $0.00 |
| **Average Loser** | −$229.49 | −$229.49 | $0.00 |
| Wins / Losses | 135 / 90 | 135 / 90 | 0 |
| Ending equity | $115,427.80 | $115,427.80 | $0.00 |

---

## 2. Long vs Short performance (measured)

| Direction | Strategy 1 | Strategy 2 |
|---|---|---|
| **Long** | 115 trades · 60.0% WR · net +$7,465.80 · PF 1.6962 | 115 trades · 60.0% WR · net +$7,465.80 · PF 1.6962 |
| **Short** | 110 trades · 60.0% WR · net +$7,962.00 · PF 1.8018 | 110 trades · 60.0% WR · net +$7,962.00 · PF 1.8018 |

Identical.

---

## 3. Sector breakdown (measured, net PnL)

| Sector | Strategy 1 | Strategy 2 |
|---|---|---|
| Semiconductors | +$12,100.00 (100% WR) | +$12,100.00 (100% WR) |
| ConsumerDisc | +$11,954.80 (100% WR) | +$11,954.80 (100% WR) |
| AutoEV | +$12,027.40 (100% WR) | +$12,027.40 (100% WR) |
| Hardware | −$10,296.00 (0% WR) | −$10,296.00 (0% WR) |
| Software | −$10,358.40 (0% WR) | −$10,358.40 (0% WR) |

Identical. *(The all-win/all-loss split by sector is a deterministic-fixture artifact, equal for both strategies.)*

---

## 4. Explicit verdict (owner requirement 7)

**Strategy 2 did NOT outperform Strategy 1 on the original OR-2 campaign. The two strategies produced IDENTICAL results.**

- Strategy 2 did **not** surpass Strategy 1's established results of **+15.43% Return** and **1.75 Profit Factor** — it **equalled** them exactly (+15.43% / 1.7469), with identical win rate, drawdown, recovery, trade count, average winner, average loser, and all Long/Short/sector breakdowns.
- Difference on every metric = **0.00**.

**بالعربية:** على حملة OR-2 الأصلية، **لم تتفوّق الاستراتيجية ٢ على الاستراتيجية ١ — النتائج متطابقة تمامًا** (نفس العائد +15.43%، نفس عامل الربح 1.75، نفس كل المقاييس). الفرق على كل مقياس = صفر.

---

## 5. Why the results are identical (factual, not theoretical)

The OR-2 fixture exercises **only the Turbo engine**; it contains **no Core trades**. Therefore:
1. **Strategy 2's Core profit exit (its main differentiator) is never invoked** — there are no Core positions to manage.
2. **The quality gate filters nothing** — every OR-2 candidate scores 100 (UltraGolden ≥ Golden threshold 95), so Strategy 2 trades the exact same candidate set as Strategy 1.
3. **Turbo exits are fixture-controlled** — every Turbo position is closed on the market-closed frame at the fixture's supplied mark (session flatten). The exit price equals that mark regardless of either strategy's exit configuration, so Turbo PnL is identical.

With its Core feature dormant on a Turbo-only dataset, Strategy 2 reduces to the same behavior as Strategy 1 → identical metrics. This is the correct, expected, and honest outcome on this fixture.

> Note: the earlier `FINAL_STRATEGY_COMPARISON_REPORT.md` showed Strategy 2 outperforming **only** because that comparison used a Core-inclusive fixture (which exercised Strategy 2's Core profit exit). On the **Turbo-only OR-2 fixture required here**, there is **no measured advantage**.

---

## 6. Run provenance & environment

| Item | Value |
|---|---|
| Commit hash used | **`f91688f`** (`f91688f258a406f939918433f1c2abda84f39274`) |
| Tests passing | **492 passed / 0 failed** (`pytest tests/` with `DATABASE_URL` set) |
| Fixture | `campaign_fixture.build_campaign()` (original OR-2) — **unchanged, no new fixture** |
| Files changed for this run | **None** (existing code run on the original fixture; only this report file is added) |
| Environment / data differences between the two runs | **None** — same PostgreSQL DB, same seed (1 user / 5 sectors / 5 instruments), same capital, same symbols, same regimes, same 90-cycle fixture, same clock. Each run used a freshly re-provisioned identical database for isolation. The sole difference is the orchestrator class. |
| Backend | `PostgresDataAccessLayer` (PostgreSQL 16) |

---

## 7. Conclusion

On a 100%-fair comparison restricted to the original OR-2 campaign, **Strategy 2 and Strategy 1 are measurably identical** (+15.43% return, 1.75 profit factor, 60% win rate, −3.34% max drawdown, 225 trades, recovered). **Strategy 2 shows no improvement over Strategy 1 on this fixture**, because OR-2 contains no Core trades and thus never exercises Strategy 2's only differentiating logic. Any measured advantage for Strategy 2 requires a dataset that includes Core trades; on Turbo-only OR-2 there is none.
