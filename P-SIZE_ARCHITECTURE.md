# P-SIZE_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No implementation. No tests. No source changes. No schema changes.**
**Derived from:** `B9_OWNER_POLICY_UPDATE.md` (capital & allocation governance) · `OWNER_PROFIT_POLICY.md` / `OWNER_PROFIT_POLICY_REVIEW.md` (non-compounding) · `P-ORCH_PIPELINE_ORCHESTRATOR_ARCHITECTURE.md` §3 (sizing stage) · `P_DATA_MARKET_DATA_ARCHITECTURE.md` (marks) · D6 (allocation base) · V2-001 (no risk-based sizing).
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** P-SIZE — Position Sizing layer (implements, does not modify, the approved fixed owner capital-allocation policy).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **P-ORCH is the sole conductor; the ordered chain Selection → Risk → Sizing → Execution → Portfolio is mandatory** · **no strategy / risk / execution / scoring changes** · **no allocation-policy change** (P-SIZE *implements* the existing fixed policy) · no new tables · no new enums · no schema changes · **no modification to D1–D14A or P-DATA/P-ORCH contracts**.

---

## 1. Purpose & Stance

P-SIZE turns a **risk-accepted** candidate into an order **quantity**, using **only** three inputs the owner already controls or the market already provides: **owner capital**, **owner allocation amount**, and **instrument price (mark)**. It is the deterministic stage-5 component P-ORCH calls between Risk and Execution.

P-SIZE **implements** the already-approved **fixed-allocation methodology** (previously a gap where quantity was supplied externally); it **introduces no new policy**. It contains **no risk-based, Kelly, volatility, or compounding logic**, makes **no automatic capital-growth assumption**, and reads **owner-configured** values — **never hardcoded**.

---

## 2. Sizing Contract

A pure, deterministic, stateless function at the integration layer (P-ORCH stage 5):

```
SizingPolicy.size(candidate, capital_settings, mark) -> SizingResult
```

- **Inputs (requirement 13 — exactly these three):**
  - **Capital Policy** — `capital_settings.capital` (owner-configured base capital).
  - **Allocation Policy** — `capital_settings.allocation` (owner-configured per-trade allocation).
  - **Instrument Price** — `mark` (current price from the P-DATA frame).
- **Output:** `SizingResult { quantity: int, allocation_value: Decimal, capital_base: Decimal, reason }` — a transient value object (not persisted; not a new entity). The `quantity` becomes the existing `Order.quantity` / `ExecutionIntent.quantity`.
- **Determinism:** same inputs → same quantity. No internal state, no randomness, no time dependence, no market/risk data beyond the mark.

**Formula (fixed allocation, unchanged methodology):**
```
allocation_value = allocation_fraction × capital            # owner config × owner capital
quantity         = floor( allocation_value ÷ mark )         # whole US-equity shares
```
(If allocation is expressed as an absolute per-trade amount instead of a fraction, `allocation_value = allocation_amount` directly — see OD-PSIZE-1.)

---

## 3. Capital Policy (requirement 3)

- **Owner-configurable capital**, sourced from configuration (env/config; B9 OD-D1) — the same owner-controlled setting governed by `B9_OWNER_POLICY_UPDATE`.
- **Base = owner-defined capital, NON-compounding** (requirements 8, 9; `OWNER_PROFIT_POLICY`): the sizing base is the **configured capital**, **not** current/growing equity. Profits accumulating in equity do **not** enlarge per-trade size.
- `capital ≤ 0` → invalid (consistent with D6 `InvalidCapital`) → **No Trade** (P-ORCH handles), never a fabricated size.
- P-SIZE **reads** capital; it never mutates it and never assumes growth.

---

## 4. Allocation Policy (requirement 4)

- **Owner-configurable allocation amount**, sourced from configuration — the "Position Allocation" setting governed by `B9_OWNER_POLICY_UPDATE`.
- Default model: a **fraction of capital** (matching the spec's fixed 10%/trade and D6's allocation-monitoring base). Expressed value validated to a sane domain (e.g., `0 < fraction ≤ 1`); out-of-domain → reject config (No Trade), never silently clamped.
- **70/30 Core/Turbo split:** remains **monitoring-only** (as in D6/B6 — "enforced nothing"). P-SIZE applies the owner allocation against owner capital and does **not** invent per-engine bucket enforcement, because doing so would be an **allocation-policy change** (forbidden). Whether sizing should respect a per-engine 70/30 bucket is **OD-PSIZE-5** (owner governance), not a P-SIZE assumption.

---

## 5. What P-SIZE Does NOT Do (requirements 5–9)

| Forbidden | Confirmation |
|-----------|--------------|
| **Risk-based sizing** (req 5) | reads no drawdown/exposure/win-rate/risk metric; V2-001 intact |
| **Kelly sizing** (req 6) | no edge/odds/Kelly fraction computation |
| **Volatility sizing** (req 7) | reads no ATR/stdev/volatility input |
| **Compounding** (req 8) | base = configured capital, not equity; no reinvestment growth |
| **Automatic capital growth** (req 9) | no equity-curve feedback; capital changes only by owner edit |

P-SIZE uses **only** `{capital, allocation, mark}`. It touches no risk, strategy, scoring, or execution input.

---

## 6. Change Governance (requirements 10–12)

- **Changes outside market hours only (req 10):** capital/allocation are editable only before session OR ≥30 min after After-Hours close (`B9_OWNER_POLICY_UPDATE`). **Enforcing the editing window is the settings layer's concern** (a future feature in the B9-policy "open items"); **P-SIZE only reads the latest approved values at session start** (P-ORCH Owner Decision 8) and never edits them.
- **Forward-only (req 11):** P-SIZE sizes **new** candidates using current settings; it **never recomputes** quantities for prior trades. Forward-only is guaranteed *by construction* — P-SIZE has no path to historical rows.
- **Historical immutability (req 12):** past `Order.quantity` / `Position` rows are **never** altered by a settings change. A capital/allocation edit affects only subsequent cycles. (Append-only audit + immutable history per `B9_OWNER_POLICY_UPDATE` Rule 4.)

> P-SIZE does **not** implement the settings-editing mechanism, change-window enforcement, or a durable settings store — those remain a future, separately-approved feature (OD-PSIZE-3). P-SIZE reads the current effective configuration.

---

## 7. Edge Cases & Fail-Safe

| Condition | Result |
|-----------|--------|
| Missing/invalid `mark` | **No Trade** (P-ORCH data-quality posture); never fabricate a price |
| `capital ≤ 0` | invalid → **No Trade** (D6 `InvalidCapital` precedent) |
| allocation out of domain (≤ 0, or fraction > 1) | reject config → **No Trade**; never clamp silently |
| `floor(allocation_value ÷ mark) < 1` (unaffordable) | **quantity 0 → No Trade** (no fractional shares; OD-PSIZE-4) |
| valid inputs | deterministic positive integer quantity |

P-SIZE never raises a trade on ambiguous input; it returns a **No-Trade** `SizingResult` with a reason, which P-ORCH audits.

---

## 8. Placement & Boundary

- **Integration-layer component** (e.g. `src/app/sizing.py` or `src/app/targets/sizing.py`), additive — invoked by **P-ORCH stage 5** (OD-PORCH-2). **No modification to D1–D14A, P-DATA, or P-ORCH contracts.**
- **No persistence of its own:** the computed quantity flows into the existing `ExecutionIntent`/`Order.quantity`. The sizing rationale is captured in P-ORCH's **Sizing audit event** (`system_events` `GatewayEvent`: capital base, allocation, quantity, or No-Trade reason) — **no new table/enum**.
- **Pure read of config + mark**: no DB writes, no Redis dependency for correctness.

---

## 9. Preserved Invariants

| Invariant | How P-SIZE preserves it |
|-----------|-------------------------|
| PostgreSQL sole source of truth | No new persistence; quantity lands in existing `Order`. |
| Redis non-authoritative | Not used for correctness. |
| Portfolio ⟂ Risk ⟂ Execution | Sizing sits strictly after Risk, before Execution; computes a quantity only — decides nothing. |
| Score/Strategy unchanged (req 14) | reads no D3 input; no scoring/selection logic. |
| Risk unchanged (req 15) | reads no risk metric; no risk-based sizing (V2-001). |
| Execution unchanged (req 16) | hands quantity to the existing target/D5; no execution-rule change. |
| Allocation policy unchanged | **implements** the existing fixed policy; introduces none; 70/30 stays monitoring-only. |
| Capital governance | owner-config, off-hours-editable, forward-only, history immutable. |
| No new tables/enums/schema | transient `SizingResult`; quantity in existing `Order`. |
| No D1–D14A / P-DATA / P-ORCH modification | additive, called by P-ORCH. |

---

## 10. Dependencies

**P-SIZE depends on:** owner **configuration** (capital + allocation; B9 OD-D1 / `B9_OWNER_POLICY_UPDATE`), the **mark** from the P-DATA frame, and the existing `Order`/`ExecutionIntent` quantity field. It is **invoked by P-ORCH**.
**P-SIZE does not depend on:** D3/D4 internals, any risk/volatility/equity metric, Redis, a broker, or a UI.
**No new third-party dependency.**

---

## 11. Owner Decisions Required

| # | Decision | Recommended |
|---|----------|-------------|
| **OD-PSIZE-1** | Allocation expression | **Fraction of capital** (matches 10%/trade + D6 base); optionally also support an absolute per-trade amount. Recommend fraction as primary. |
| **OD-PSIZE-2** | Capital base | **Owner-defined fixed capital (non-compounding)** — confirm; equity-based compounding is forbidden (profit policy / V2). |
| **OD-PSIZE-3** | Settings source | **Config (env) now**; a durable settings store with change-window enforcement + change audit is a **future versioned feature** (not P-SIZE). |
| **OD-PSIZE-4** | Rounding/affordability | **Floor to whole shares; < 1 share → No Trade**; no fractional shares in v1. |
| **OD-PSIZE-5** | 70/30 Core/Turbo in sizing | **Keep 70/30 monitoring-only** (D6, unchanged); per-engine bucket sizing would be an allocation-policy change requiring separate governance — not assumed here. |

---

## 12. Definition of Done (requirement 17)

1. **`SizingPolicy.size(candidate, capital_settings, mark) → SizingResult`** — deterministic, stateless, integration-layer; invoked by P-ORCH stage 5.
2. **Quantity derived solely from Capital Policy + Allocation Policy + Instrument Price** (req 13): `floor(allocation_value ÷ mark)`.
3. **Owner-configurable capital & allocation** (req 3, 4), read from config; **never hardcoded**.
4. **No risk-based / Kelly / volatility / compounding / auto-growth** logic (req 5–9) — uses only `{capital, allocation, mark}`.
5. **Non-compounding base** = owner-defined capital, not equity.
6. **Change governance** (req 10–12): reads latest approved settings at session start; forward-only by construction; historical quantities immutable; editing-window enforcement is the settings layer's (future) concern.
7. **Edge/fail-safe**: missing mark / invalid capital / bad allocation / unaffordable → **No Trade** with reason; never fabricate.
8. **Sizing audit event** via P-ORCH (`system_events` `GatewayEvent`): capital base, allocation, quantity / No-Trade reason — no new enum/table.
9. **Invariants preserved** (§9); **no strategy/risk/execution/allocation change**; no D1–D14A / P-DATA / P-ORCH modification.
10. Owner decisions OD-PSIZE-1…5 resolved.
11. (Future build) tests: formula correctness, floor/affordability, invalid-input No-Trade, config-read (no hardcode), determinism, and a guarantee of **no risk/volatility/equity inputs**.
12. `P-SIZE_BUILD_REPORT.md` produced at the future build gate; this document stops at architecture.

---

## 13. Remaining Implementation Impact (requirement 18)

- **Closes the P-ORCH stage-5 gap:** with P-SIZE built, the orchestrator can size accepted candidates per the approved policy. Combined with **P-DATA build + P-DEPLOY + P-ORCH build**, this enables the **first autonomous paper-trading run**.
- **Impact on existing layers: none** — P-SIZE is additive and read-only with respect to D1–D14A; it changes the fact that quantity was previously *supplied externally* to being *computed from owner config* per the fixed policy. The build audit must confirm **no risk/strategy/execution/allocation change** and **no hardcoded capital**.
- **Sequence after P-SIZE:** P-DATA build → P-SIZE build → P-ORCH build → P-DEPLOY → **first paper run** → D14 build → 30-day/200-trade validation → D14A build → (future, gated) D13 IBKR.
- **No schema/table/enum impact**; **no governance change** (P-SIZE implements existing capital/allocation governance, does not alter it).

---

## 14. Stop Gate

**STOP.**

Architecture only — no code, no implementation, no tests, no source/schema changes, no modification to D1–D14A or P-DATA/P-ORCH. P-SIZE **implements** the already-approved fixed owner capital-allocation policy with **no risk/Kelly/volatility/compounding logic**, **non-compounding** owner-defined capital base, **owner-configurable** capital/allocation read from config (never hardcoded), and **forward-only** application leaving history immutable. Await owner review and rulings on **OD-PSIZE-1…OD-PSIZE-5** before any P-SIZE implementation begins.
