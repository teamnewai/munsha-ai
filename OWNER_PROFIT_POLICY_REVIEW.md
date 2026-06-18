# OWNER_PROFIT_POLICY_REVIEW

**Type:** Governance / architecture review. **Documentation only — no code, no tests, no implementation, no source/schema changes.**
**Reviews:** how **profit** is currently treated across THUL-NURAYN, and what profit-policy decisions are **governed**, **frozen (v1)**, or **deferred (V2+)**.
**Grounded in:** `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` · D6 Portfolio (capital/PnL) · `B9_OWNER_POLICY_UPDATE.md` (capital & allocation governance) · `D14_PAPER_VALIDATION_ARCHITECTURE.md` (profit metrics/gates) · approved B1–B9 / D10–D14 artifacts.
**Status:** Review only — no policy is enacted by this document; owner decisions are listed for sign-off.

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no strategy / risk / execution-rule / capital-recovery / position-allocation changes** · no new tables · no new enums · no schema changes · **no modification to D1–D14** · all profit-policy changes are **forward-only**; **historical positions/PnL/audit/performance/recovery records are never recalculated** (`B9_OWNER_POLICY_UPDATE` Rule 4).

> **Note on scope:** there is no pre-existing `OWNER_PROFIT_POLICY.md` artifact. This review therefore (a) documents the **de-facto profit treatment already implemented in v1**, (b) classifies the open profit-policy questions, and (c) enumerates owner decisions. It enacts nothing.

---

## 1. Purpose

Give the owner a single, accurate picture of **what "profit" means in v1 today**, what is **locked**, and which profit-related choices require an explicit decision — without touching the frozen engine. Profit policy spans four distinct areas that are frequently conflated; this review separates them so each is governed at the right layer.

---

## 2. The Four Profit-Policy Areas (kept separate)

| Area | What it governs | Correct layer | v1 status |
|------|-----------------|---------------|-----------|
| **A. Profit accounting** | How realized/unrealized profit is computed and recorded | D6 Portfolio (formulas) | **Implemented & frozen** |
| **B. Profit handling (capital)** | Reinvestment vs withdrawal; compounding vs fixed capital; allocation base | Governance (extends `B9_OWNER_POLICY_UPDATE`) | **Governed; currently non-compounding** |
| **C. Profit-taking (exits)** | When a trade closes for profit (targets/trailing) | Strategy/Execution (D3–D5) | **Frozen v1 → V2** |
| **D. Profit distribution / fees** | Performance fees, payouts, profit sharing across tiers | Business/subscription governance | **Out of engine scope; deferred** |

Conflating these is the main risk: **B and D are governance**, **C is frozen strategy**, **A is settled math**. This review treats each accordingly.

---

## 3. De-Facto Profit Treatment in v1 (as built — read from D6)

These are **facts about the current implementation**, not proposals:

1. **Realized profit** is booked when a position closes: `PnL = (exit − entry) × qty` (Long) / `(entry − exit) × qty` (Short); missing prices → 0 (fail-safe). (`PnLCalculator.realized_for_position`.)
2. **Cash convention:** `cash = starting_capital + Σ realized PnL` over all closed positions. (D6 `AccountState`; B6 assumption 9.)
3. **Equity:** `equity = cash + unrealized_pnl` (unrealized from supplied marks; missing marks excluded — fail-safe).
4. **High-water mark & drawdown** track `equity`; `drawdown = (equity − HWM)/HWM ≤ 0` (D4-aligned).
5. **Starting capital** is configuration (env/config; B9 OD-D1); it is **not** auto-adjusted by accumulated profit.
6. **Position allocation** is the **fixed methodology** (10%/trade; risk-based sizing is V2-001) and is **monitored against `starting_capital`**, not against growing equity (B6 allocation monitoring). ⇒ **v1 is effectively NON-compounding at the allocation level**: profits accrue in cash/equity but do not enlarge per-trade size.
7. **No withdrawal/reinvestment automation** exists anywhere; profit simply accumulates in cash/equity.
8. **No profit-taking exit rule** is part of the v1 score/risk/execution logic (entry-and-lifecycle focused; the exit *decision* is strategy and is not parameterized for profit targets in v1).
9. **Performance records** (daily/weekly/monthly) capture `realized_pnl`, `win_rate`, trades/wins/losses — the durable profit history. **Append-only / never recalculated.**

**Implication:** the single most consequential *open* profit-policy question is **Area B**: does per-trade allocation stay based on fixed `starting_capital` (non-compounding, current behavior) or move to current equity (compounding)? That is an allocation-base decision and is **governed**, but **changing it is a methodology change → V2** (see §5).

---

## 4. What Is FROZEN (no change in v1)

- **A. Profit accounting formulas** (PnL, cash, equity, HWM, drawdown) — settled in D6; changing them is a capital/portfolio-formula change, **disallowed** in v1.
- **C. Profit-taking exit logic** — any "take profit at X / trail by Y" rule is **strategy/execution** and is **frozen**; introducing it is a **V2_BACKLOG** item requiring formal architecture review and versioned approval. It must **not** be added under the guise of a "policy."
- **Position-allocation methodology** (fixed %, V2-001) — frozen; compounding/risk-based sizing is V2.
- **Capital-recovery methodology** (B9/D6 rebuild: cash = capital + Σ realized PnL) — frozen.

These align with `B9_OWNER_POLICY_UPDATE` Rule 5 ("current strategy, risk, execution, capital-recovery, and portfolio formulas remain unchanged").

---

## 5. What Is GOVERNED (owner may set, forward-only)

Consistent with `B9_OWNER_POLICY_UPDATE` (capital & allocation are configurable, **before session OR ≥30 min after After-Hours close**, **forward-only**, **history never recalculated**):

- **B. Profit handling (capital):**
  - **Compounding vs fixed capital** (allocation base = current equity vs `starting_capital`). *Note:* enabling compounding is a **position-allocation methodology change** → **V2 + versioned approval**, even though the *policy intent* is governance. v1 stays **non-compounding**.
  - **Reinvestment vs withdrawal of realized profit** — whether realized profit is periodically swept out (withdrawal) or left to accumulate (current behavior). A **governance setting**; if it requires changing `starting_capital`/capital base mid-life, it follows the B9 change-window + forward-only rules. Implementing an automated sweep/withdrawal would be a **future versioned feature** (likely a schema/ops decision); v1 has none.
  - **Profit-sweep timing** — if/when profits are recognized for withdrawal (e.g., end-of-month), governed by the same change-window discipline.
- **Profit-related governance changes never recalculate history** (Rule 4): past positions/PnL/audit/performance/recovery records are immutable.

---

## 6. What Feeds VALIDATION (profit as a gate, not a rule)

Profit metrics are already defined as **read-only validation gates** in `D14_PAPER_VALIDATION_ARCHITECTURE` — they govern **deployment eligibility**, never trading:
- **Profit Factor**, **Portfolio Return**, **Max Drawdown**, **Recovery**, **Score-band/sector/regime profit breakdowns**.
- These are **eligibility thresholds** (governance config) for moving Paper → Live (D13), **distinct from D4 risk gates**.
- A "profit policy" expressed as *minimum profitability before live* belongs here (D14 OD-D14-4/5), not in the engine.

---

## 7. What Is DEFERRED / OUT OF ENGINE SCOPE

- **D. Profit distribution / performance fees / payouts / profit sharing across subscription tiers** — business governance, independent of the trading engine; tied to the future subscription system (D11 OD-6 deferred). **Not** a trading-engine concern; no v1 mechanism.
- **Automated reinvestment/withdrawal execution** — future versioned feature (schema/ops).
- **Profit-taking strategy** (Area C) — V2_BACKLOG.
- **Compounding allocation** — V2 (position-sizing).

---

## 8. Preserved Invariants

| Invariant | Preserved by |
|-----------|--------------|
| PostgreSQL sole source of truth | Profit is derived from persisted positions/fills; performance_records durable. |
| Portfolio ⟂ Risk ⟂ Execution | Profit accounting (D6) is separate from risk (D4) and execution (D5); profit policy adds no cross-coupling. |
| No strategy/risk/execution/capital-recovery/allocation change | Areas A & C frozen; B governed but methodology change is V2. |
| Forward-only governance; history immutable | All profit-policy changes follow B9 change-window + no-recalculation. |
| No new tables/enums/schema; no D1–D14 modification | This is a review; any future automated sweep/compounding is a separate versioned decision. |
| IP protection | Profit reporting does not expose the scoring formula (consistent with D12/D14). |

---

## 9. Owner Decisions Required

| # | Decision | Classification | Recommended |
|---|----------|----------------|-------------|
| **OP-1** | Allocation base: fixed `starting_capital` (non-compounding) vs current equity (compounding) | **V2** (position-sizing methodology) | **Keep fixed/non-compounding in v1**; compounding → V2 versioned review |
| **OP-2** | Realized-profit handling: accumulate (current) vs periodic withdrawal/sweep | Governance; automation = future feature | **Accumulate in v1** (no automation); revisit with a versioned feature |
| **OP-3** | Profit-taking exits (targets/trailing) | **Frozen strategy → V2_BACKLOG** | **Do not add in v1**; formal architecture review required |
| **OP-4** | Profit-based eligibility thresholds (Paper→Live) | Governance via D14 | Set values under D14 OD-D14-4/5 (owner numbers) |
| **OP-5** | Profit distribution / performance fees / payouts | Business governance (out of engine) | Define with the future subscription system (D11 OD-6) |
| **OP-6** | Profit-reporting granularity (what's published outward, IP) | Governance | Publish results/bands only; **never** raw score/formula (D12/D14) |

None is enacted here; each awaits explicit owner sign-off. Items OP-1/OP-3/OP-5 are **not** v1 changes by classification.

---

## 10. Recommendations Summary

1. **Keep v1 profit behavior exactly as built:** realized-PnL accounting (A) frozen; **non-compounding** fixed-allocation; profits accumulate in cash/equity; no automated withdrawal; no profit-taking exit rule.
2. **Treat profit *handling* (B) as governance** under the existing `B9_OWNER_POLICY_UPDATE` discipline (change-window, forward-only, history immutable) — but recognize that **compounding or automated sweeps are V2 features**, not v1 config flips.
3. **Express "minimum profitability before live" as D14 eligibility gates** (governance), not as engine rules.
4. **Keep profit distribution/fees (D) entirely in business/subscription governance**, decoupled from the trading engine.
5. **Protect IP**: profit reporting exposes results/bands, never the scoring formula.
6. **Record this as a governance review** — not a permanent restriction; V2+ may revise profit/compounding/withdrawal/fee policy via formal architecture review and versioned approval (mirroring `B9_OWNER_POLICY_UPDATE` Rule 6).

---

## 11. Stop Gate

**STOP.**

Governance/architecture review only — no code, no implementation, no source/schema changes, no modification to D1–D14, and **no policy enacted**. The frozen engine (profit accounting + profit-taking strategy + allocation/capital-recovery methodology) is unchanged. Await owner rulings on **OP-1…OP-6**; profit-handling automation, compounding, profit-taking exits, and distribution/fees each remain **future versioned decisions**.
