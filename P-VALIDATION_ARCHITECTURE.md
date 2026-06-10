# P-VALIDATION_ARCHITECTURE

**Type:** Validation-campaign architecture review. **Architecture only — no code, no implementation, no source/schema changes.**
**Derived from:** approved **Owner Validation Policy** · `D14_PAPER_VALIDATION_ARCHITECTURE.md` (metric design this operationalizes) · `P-DEPLOY_ARCHITECTURE.md` (the environment) · `P-ORCH`/`P-DATA`/`P-SIZE` builds · `B9_OWNER_POLICY_UPDATE.md` / `OWNER_PROFIT_POLICY.md` (governance).
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** P-VALIDATION — the first autonomous **paper-trading** validation campaign (the gate before any live/IBKR eligibility).

**Invariants preserved:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · Portfolio ⟂ Risk ⟂ Execution · **no strategy / risk / execution / allocation / profit / schema changes** · validation is **observational** (measures, never trades or tunes) · **no broker · no live trading · no TradingView · no IBKR** · **no auto-tuning** (D14A advisory only). Thresholds are **eligibility gates**, distinct from D4 risk gates.

---

## 1. Validation Architecture

The campaign runs the approved **Paper** pipeline (P-ORCH `EXECUTION_TARGET=paper`, P-DATA Replay/Fixture, P-SIZE fixed allocation) and **measures** it read-only against the Owner Validation Policy. It changes nothing in the engine.

```
  P-DATA(Replay) → P-ORCH cycles → Paper fills/positions (PostgreSQL = truth)
                                         │ read-only
                                         ▼
        D14 Validation metrics (read-only over persisted rows; reuses D6 calculators)
                                         │
                ┌────────────────────────┴───────────────────────┐
                ▼                                                  ▼
        Period reports (D/W/M/cumulative)              Pass/Fail gate evaluation
        (core stats via performance_records;            (governance thresholds;
         extended metrics computed/exported)            eligibility only)
                                         │
                                         ▼
                          D14A Trade Intelligence (ADVISORY only)
```

- **Measurement layer = D14** (already architected): read-only metric calculators over `positions`/`orders`/`fills`/`scores`/`signals`/`instruments`/`market_snapshots`/`performance_records`, reusing D6 `PnLCalculator`/`StatisticsCalculator`/`EquityTracker` — **no formula change**.
- **Eligibility gate = governance thresholds** evaluated against the `ValidationReport`; passing/failing changes **deployment eligibility**, never a trade.
- **Intelligence = D14A** (advisory only): explains winners/losers; **never** auto-applies any change (human-gated).
- **Identity:** paper rows are tagged `broker_ref="paper:"`; the campaign measures only paper data.

> P-VALIDATION introduces **no new computation** beyond what D14/D14A already specify; it is the **campaign that runs and evaluates** them. Implementing D14/D14A reporting is their own build phases (gated separately); this document defines how the campaign is conducted and judged.

---

## 2. Validation Workflow

1. **Pre-run readiness** (§9) satisfied; P-DEPLOY paper environment up; `application.start()` issued.
2. **Campaign window opens** — record `campaign_start` (NY session calendar, D2). The clock counts **trading days**.
3. **Autonomous cycles** run via P-ORCH (scan→risk→size→paper-fill→portfolio→audit), accumulating durable paper rows.
4. **Daily measurement** (§3): generate the daily `ValidationReport`; append the day's `performance_records` (D/W/M via D6 `persist_stats`); track cumulative metrics.
5. **Continuous gate monitoring:** failure criteria (§5) are checked **every day**; a hard breach triggers escalation (§7) and may halt the campaign clock.
6. **Completion test:** when **both** duration (≥30 trading days) **and** sample (≥200 closed trades) are met, evaluate the **full Pass/Fail rule set** (§5) on the cumulative report.
7. **Outcome:**
   - **PASS** → campaign closed PASS; produces the live-eligibility evidence package (eligibility only; live remains separately owner-gated + versioned).
   - **FAIL** → campaign closed FAIL; forward-only rollback to Signals/Paper per governance; **history never recalculated**.

All workflow events are recorded durably (`system_events` / `performance_records`); the report is reproducible from PostgreSQL.

---

## 3. Daily Operation Procedure

| Step | Action |
|------|--------|
| **Health check** | Confirm operational state RUNNING/DEGRADED (PG up mandatory; Redis optional). PG down ⇒ campaign paused until restored. |
| **Cycle confirmation** | Verify the day's trading cycles ran (audit `cycle_summary` events present for the session). |
| **DLQ review** | Inspect unresolved DLQ depth; investigate any `WorkerFailure`/data-quality rejects; **manual** resolution (no auto-retry). A data/integrity failure attributable to a **system defect** is a failure-criterion trigger (§5). |
| **Daily report** | Generate the daily `ValidationReport` (metrics §4) + persist daily `performance_records`. |
| **Cumulative update** | Update running cumulative metrics + regime/direction coverage trackers. |
| **Gate check** | Evaluate failure criteria (§5) on cumulative data; escalate on breach (§7). |
| **Partition/ops** | Confirm upcoming partition exists (MissingPartitionDetector); confirm PostgreSQL backup ran. |
| **Operator sign-off** | Record the day's review (operator + timestamp) in the campaign log. |

Daily operation is **read-only with respect to domain data** (it measures and records reports; it never edits positions/PnL/audit).

---

## 4. Validation Metrics (per Owner Validation Policy + D14)

Computed read-only over the campaign's paper rows (reuses D6; see D14 §4):

| Metric | Definition | Policy target |
|--------|------------|---------------|
| **Duration** | distinct NY trading days in [start, now] | **≥ 30** |
| **Trades** | closed paper positions (completed round-trips) | **≥ 200** |
| **Win Rate** | wins / trades (win = realized PnL > 0) | **≥ 85%** |
| **Profit Factor** | Σ winning PnL / \|Σ losing PnL\| | **≥ 2.0** |
| **Maximum Drawdown** | min of (equity − HWM)/HWM over the curve | **≤ 10%** (i.e. ≥ −10%) |
| **Portfolio Return** | (equity_end − starting_capital)/starting_capital | **> 0** |
| **Recovery** | every drawdown trough recovers to a new HWM within the window | **required** (no unrecovered DD at completion) |
| **Regime coverage** | distinct `market_snapshots.regime` observed during trades | **≥ 2** regimes |
| **Direction coverage** | both `Long` and `Short` positions present and evaluated | **both tested** |

Supporting (diagnostic, D14/D14A; not pass/fail by themselves): consecutive W/L, sector/regime/long-vs-short/score-band breakdowns. **R-multiple uses the D14 proxy** (no native risk basis in v1; OD-D14-1) and is reporting-only.

> **Recorded limitation (from the P-ORCH compliance audit):** the current P-ORCH wiring feeds **daily-DD** but uses **weekly-DD / sector-exposure defaults (0)** as D4 inputs. This does **not** affect the *validation* drawdown metric (computed independently by D14 over the equity curve), but the owner should note that D4's *weekly-DD/sector* gates are under-fed during the campaign until input enrichment is added. Flagged, not a rule change.

---

## 5. Pass/Fail Rules

**PASS requires ALL of the following on the cumulative report at completion:**
1. Duration ≥ 30 trading days **AND**
2. Trades ≥ 200 closed **AND**
3. Win Rate ≥ 85% **AND**
4. Profit Factor ≥ 2.0 **AND**
5. Maximum Drawdown ≤ 10% (never breached intra-campaign) **AND**
6. Portfolio Return > 0 **AND**
7. Recovery satisfied (no unrecovered drawdown at completion) **AND**
8. ≥ 2 market regimes observed **AND**
9. Both Long and Short tested **AND**
10. **Integrity:** no system-defect-caused D4 limit breach, no kill-switch L3/L4 from a system error, no unresolved execution DLQ, and data-quality coverage sufficient to trust the metrics.

**FAIL if any of:**
- Any threshold (1–9) unmet at completion, **or**
- A hard breach during the campaign: Maximum Drawdown exceeds 10% at any point; a D4 risk limit breached due to a **system defect**; kill-switch L3/L4 triggered by a system/integrity error; reconciliation/integrity errors or unresolved execution DLQ; data-quality coverage below the minimum to trust results.

**Determinism:** Pass/Fail is computed from persisted data and is fully reproducible. Thresholds are **governance gates** (eligibility), never injected into D3/D4 trading logic.

---

## 6. Reporting Structure

| Report | Cadence | Content | Storage |
|--------|---------|---------|---------|
| **Daily** | each trading day | day's trades, win rate, PnL, DD, DLQ, gate snapshot | core stats → `performance_records` (daily); extended → exported artifact |
| **Weekly** | weekly | rolled-up metrics + regime/direction coverage progress | `performance_records` (weekly) + artifact |
| **Monthly** | monthly | period summary + drawdown/recovery profile | `performance_records` (monthly) + artifact |
| **Cumulative** | continuous + at completion | full metric set (§4) + Pass/Fail evaluation (§5) + data-quality flags | exported `ValidationReport` artifact (reproducible from PostgreSQL) |
| **Intelligence** | per cadence (D14A) | winners-vs-losers factor analysis — **advisory only** | exported artifact; **no auto-apply** |

- Core period stats reuse the **existing `performance_records`** table (no schema change). Extended metrics + the `ValidationReport` are computed/exported read-only (durable storage of extended metrics is a future versioned decision, D14 OD-D14-3).
- Every report is reproducible from the durable rows; secrets redacted.

---

## 7. Escalation Rules

| Trigger | Severity | Action |
|---------|----------|--------|
| PostgreSQL unreachable | Emergency | Campaign paused (not-ready); restore DB; clock excludes the outage; resume after recovery verified |
| Maximum Drawdown breaches 10% | Critical | **Campaign FAIL** (hard breach §5); halt clock; owner review; rollback to Signals/Paper (forward-only) |
| Kill-switch L3/L4 from system error | Emergency | **FAIL**; investigate; history preserved |
| D4 limit breach due to system defect | Critical | **FAIL**; defect must be fixed via the standard architecture-review process before any re-run |
| Unresolved execution DLQ / reconciliation error | Critical | Investigate + resolve manually; if defect-caused → FAIL |
| Redis down | Warning | DEGRADED; campaign continues on PostgreSQL; no clock impact |
| Coverage shortfall (regime/direction/data-quality) approaching deadline | Warning | Owner notified; campaign may extend to meet coverage (duration/sample are minimums) |
| Recommendation produced (D14A) | Info | **Advisory only**; recorded for owner; **never auto-applied** |

All escalations are recorded durably; remediation of any **system defect** is a separate, owner-gated architecture-review action (the freeze and "no auto-tuning" hold).

---

## 8. Validation Completion Checklist
- [ ] Duration ≥ 30 trading days reached.
- [ ] ≥ 200 closed paper trades.
- [ ] Win Rate ≥ 85% (cumulative).
- [ ] Profit Factor ≥ 2.0.
- [ ] Maximum Drawdown ≤ 10% (never breached).
- [ ] Positive portfolio return.
- [ ] Recovery satisfied (no unrecovered drawdown).
- [ ] ≥ 2 market regimes observed.
- [ ] Long **and** Short both tested.
- [ ] Integrity clean (no system-defect breaches, no execution DLQ, sufficient data-quality coverage).
- [ ] Cumulative `ValidationReport` produced and **reproducible from PostgreSQL**.
- [ ] D14A intelligence report produced (advisory).
- [ ] Owner sign-off recorded.
- [ ] Outcome (PASS/FAIL) recorded durably; on FAIL, forward-only rollback applied, **history not recalculated**.
- [ ] (On PASS) live-eligibility evidence package compiled — live/IBKR remains **separately owner-gated + versioned**.

## 9. Readiness Checklist Before First Paper Run
*(Inherits the P-DEPLOY §13 checklist; campaign-specific additions below.)*
- [ ] P-DEPLOY validation checklist fully satisfied (PostgreSQL reachable + schema + partitions + seed + env `EXECUTION_TARGET=paper`).
- [ ] Full test suite green in the deploy image (**372 passed / 24 skipped**; the 24 DB-integration tests green against the provisioned PostgreSQL).
- [ ] D14 measurement reporting available (its build approved/done) to compute the daily/cumulative `ValidationReport`.
- [ ] Fixture/data source provides enough breadth to plausibly reach **2+ regimes** and **both directions** within the window.
- [ ] Operator daily-procedure runbook (§3) in place; campaign log/sign-off mechanism ready.
- [ ] PostgreSQL backup (pg_dump/PITR) scheduled; monitoring + alerts wired (health, DLQ, partitions).
- [ ] Kill-switch operability verified (operator can record a level; loop honors it).
- [ ] Data-quality reject path verified (bad frame → Reject Cycle + DLQ, no trade).
- [ ] `campaign_start` recorded; `application.start()` issued only after recovered-state verification.
- [ ] Confirmed: **no broker / TradingView / IBKR wired; Paper target only; no live trading.**

---

## 10. Out of Scope (P-VALIDATION)
- Any code/source/schema change; any strategy/risk/execution/allocation/profit change.
- Auto-tuning / ML / applying D14A recommendations (advisory only).
- Live broker connectivity, IBKR, TradingView, market-data vendor.
- Live-trading authorization (a separate owner-gated, versioned decision **after** a PASS campaign).

## 11. Stop Gate
**STOP.**

Validation-campaign architecture only — no code, no implementation, no source/schema changes. Await owner approval before conducting the campaign. Do not begin TradingView, IBKR, or Live Trading; live eligibility requires a **PASS** campaign **plus** separate versioned owner approval.
