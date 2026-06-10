# P-SIZE_NONFINITE_REMEDIATION_ARCHITECTURE

**Type:** Remediation architecture + audit for the non-finite `Decimal` fail-safe gap. **Documentation only — no code, no implementation, no tests, no schema changes.**
**Source of finding:** `P-SIZE_FINAL_INDEPENDENT_AUDIT.md` Issue #1 (owner-accepted).
**Grounded in live source probes** of `src/app/sizing.py` (`SizingPolicy.size`, `CapitalSettings.from_env`).

---

## 1. Problem Statement (from source, exact)

`Decimal` accepts the non-finite values `NaN`, `Infinity`, `-Infinity`. The current `SizingPolicy.size` validates with comparisons (`<= 0`, `> 1`) and a final `int(... ROUND_DOWN)` — none of which is safe for non-finite operands. Live behavior:

| Input | Current behavior | Correct? |
|-------|------------------|----------|
| `mark = NaN` | **RAISES `InvalidOperation`** | ❌ should be No-Trade |
| `mark = +Inf` | No-Trade, reason `"unaffordable …"` | ⚠️ safe outcome, **wrong reason** |
| `mark = -Inf` | No-Trade `"invalid mark (-Infinity)"` | ⚠️ incidentally correct (via `<=0`) |
| `capital = NaN` | **RAISES `InvalidOperation`** | ❌ should be No-Trade |
| `capital = +Inf` | **RAISES `OverflowError`** (int conversion) | ❌ should be No-Trade |
| `capital = -Inf` | No-Trade `"invalid capital (-Infinity)"` | ⚠️ incidentally correct |
| `allocation = NaN` | **RAISES `InvalidOperation`** | ❌ should be No-Trade |
| `allocation = +Inf` | No-Trade `"invalid allocation fraction (Infinity)"` | ⚠️ incidentally correct (via `>1`) |
| `allocation = -Inf` | No-Trade `"invalid allocation fraction (-Infinity)"` | ⚠️ incidentally correct |
| `from_env("NaN"/"Infinity")` | **Parsed and accepted** (not rejected) | ❌ should be rejected |

**Defect class:** `NaN` (any field) and `+Infinity` (capital, and mislabeled mark) breach the stated fail-safe contract ("invalid → No-Trade with explicit reason; never fabricate; never raise"). `-Inf`/`+Inf-allocation` are *incidentally* safe but not *intentionally* handled.

---

## 2. Exact Remediation Contract (point 2)

**Principle:** a non-finite number is, by definition, **not a valid trading quantity input**. All non-finite values must yield a **deterministic No-Trade with an explicit reason** — never an exception, never a fabricated quantity.

| Value | `size()` expected behavior | `from_env()` expected behavior |
|-------|----------------------------|--------------------------------|
| **NaN** (mark, capital, or allocation) | **No-Trade**, reason `"non-finite <field> (NaN)"` | **Reject** → `ValueError` (config misconfiguration; fail-fast) |
| **+Infinity** | **No-Trade**, reason `"non-finite <field> (Infinity)"` | **Reject** → `ValueError` |
| **-Infinity** | **No-Trade**, reason `"non-finite <field> (-Infinity)"` | **Reject** → `ValueError` |

**Ordering rule:** the finiteness check is performed **first**, before any `<=`/`>` comparison or `int()` conversion, for each of `mark`, `capital`, `allocation_fraction`. (Mechanism: `Decimal.is_finite()` — returns `False` for NaN/±Inf, `True` for finite numbers.)

**Invariants of the contract:**
- `size()` **never raises** on any `Decimal` input (only returns a `SizingResult`).
- A No-Trade always carries `quantity=0`, `tradable=False`, explicit `reason`.
- `from_env()` rejects non-finite config exactly as it already rejects unparseable strings (fail-fast at startup; a non-finite capital/allocation is a deployment error).
- **No fabricated price or quantity** ever.

---

## 3. Responsibility (point 3)

**Both — defense-in-depth, with P-SIZE as the authoritative self-guard.**

| Layer | Responsibility | Status |
|-------|----------------|--------|
| **P-SIZE (primary, non-negotiable)** | `size()` must self-protect against non-finite inputs and never raise; `from_env()` must reject non-finite config. P-SIZE is independently callable + directly unit-tested; its stated contract is "invalid → No-Trade." | **Must fix here** |
| **P-ORCH data-quality gate (secondary, future)** | The cycle-level gate already specifies *Missing Price / Invalid Volume / Stale / Duplicate / Market-Closed → Reject Cycle*. A **non-finite mark** is an "invalid price" and should also Reject Cycle — defense-in-depth so non-finite never even reaches sizing in the pipeline. | **Add when P-ORCH is built** (does not exist yet — verified) |

**Why not P-ORCH alone:** source confirms **P-ORCH does not exist yet**, and P-SIZE is called directly (by tests today, by P-ORCH later). Relying solely on an unbuilt upstream gate would ship P-SIZE with a live crash path that nothing guards. P-SIZE's self-guard is the correctness boundary; P-ORCH's gate is an additional safety net.

---

## 4. Preferred Architecture (point 4)

**P-SIZE finiteness guard (primary) + P-ORCH data-quality non-finite rejection (secondary, at P-ORCH build).**

- In `SizingPolicy.size`: add an up-front per-field `is_finite()` check for `mark`, `capital`, `allocation_fraction` → `SizingResult.no_trade("non-finite <field> (<value>)")`, **before** any comparison/arithmetic. Also correct the `+Inf mark` mislabel (now caught by the finite guard).
- In `CapitalSettings.from_env`: after parsing, if either value `not is_finite()` → raise `ValueError` (same posture as unparseable).
- This is **additive, deterministic, stdlib-only** (`Decimal.is_finite()`), and **changes no signature, DTO, or formula** — it only **extends the existing fail-safe branch set** the architecture already mandates.
- The P-ORCH data-quality gate (when built) treats a non-finite mark as "invalid price → Reject Cycle → Alert → No Trade" — using the already-approved P-ORCH §4 mechanism (no new contract).

---

## 5. Files Requiring Modification (point 5)

| File | Change | Frozen? |
|------|--------|---------|
| `thul-nurayn/src/app/sizing.py` | Add `is_finite()` guards in `size()` (mark/capital/allocation) + reject non-finite in `from_env()` | **No** — P-SIZE is the active phase, not frozen |
| `thul-nurayn/tests/test_sizing.py` | Add non-finite tests (see §6) | **No** — active phase tests |
| *(future, at P-ORCH build)* P-ORCH data-quality module | Reject non-finite mark as invalid price | not yet created |

**No other file** is touched. **No D1–D14A / B9 / persistence / schema / config / operations file** is modified.

---

## 6. Tests To Be Added (point 6)

| Test | Asserts |
|------|---------|
| `test_mark_nan_no_trade` | NaN mark → No-Trade, reason mentions non-finite, **no raise** |
| `test_mark_pos_inf_no_trade` | +Inf mark → No-Trade (explicit non-finite reason, **not** "unaffordable") |
| `test_mark_neg_inf_no_trade` | -Inf mark → No-Trade (explicit non-finite reason) |
| `test_capital_nan_no_trade` | NaN capital → No-Trade, no raise |
| `test_capital_pos_inf_no_trade` | +Inf capital → No-Trade (no `OverflowError`) |
| `test_capital_neg_inf_no_trade` | -Inf capital → No-Trade |
| `test_allocation_nan_no_trade` | NaN allocation → No-Trade, no raise |
| `test_allocation_pos_inf_no_trade` | +Inf allocation → No-Trade (explicit non-finite reason) |
| `test_allocation_neg_inf_no_trade` | -Inf allocation → No-Trade |
| `test_size_never_raises_on_any_decimal` | property: across {NaN,±Inf,finite}× fields, `size()` returns a `SizingResult` and never raises |
| `test_from_env_rejects_nan` | `STARTING_CAPITAL=NaN` → `ValueError` |
| `test_from_env_rejects_infinity` | `POSITION_ALLOCATION_FRACTION=Infinity` → `ValueError` |

(~12 new tests; all always-run, deterministic.)

---

## 7. Change-Impact Audit (point 7)

| Could the fix change…? | Verdict | Why |
|------------------------|---------|-----|
| Approved architecture | **No** | `P-SIZE_ARCHITECTURE.md` §7 already mandates "invalid → No Trade." Non-finite **is** invalid; the fix *implements the existing intent more completely*. No architecture doc changes. |
| Frozen contract (signature/DTO) | **No** | `size(candidate, settings, mark) → SizingResult` and `SizingResult`/`CapitalSettings` shapes **unchanged**; only additional No-Trade `reason` strings + a `from_env` rejection branch. |
| Schema / tables / enums | **No** | P-SIZE has no persistence; nothing DB-touching. |
| D1–D9 behavior (domain phases) | **No** | No D1–D9 file touched; sizing is integration-layer only. |
| Owner decisions | **No** | No owner decision altered. The fix is consistent with OD-PSIZE (fixed allocation, fail-safe) and the profit/capital governance. (`POSITION_ALLOCATION_FRACTION` key name remains OD-PSIZE-3, unaffected.) |
| Freeze integrity | **No** | Only the **active** P-SIZE files (`sizing.py`, `test_sizing.py`) change; all frozen layers untouched. |

**Net:** a small, additive, freeze-safe hardening **within** the already-approved fail-safe contract — not a new policy, contract, or architecture.

---

## 8. Final Recommendation

### ✅ **A) FIX BEFORE P-DATA**

**Justification (from source evidence):**
1. **P-SIZE currently raises on valid `Decimal` inputs** (`NaN` any field; `+Inf` capital → `OverflowError`) — a direct breach of its own fail-safe contract ("never fabricate / invalid → No-Trade"). Verified live, not inferred.
2. **The proposed upstream guard (P-ORCH data-quality gate) does not exist yet** — `ls` confirms no `app/orch*`/`pipeline`/`marketdata`. Deferring to P-ORCH means shipping P-SIZE with an unguarded crash path that **nothing** currently catches, and P-SIZE is already callable/tested directly.
3. **The fix is tiny, additive, deterministic, stdlib-only (`is_finite()`), and freeze-safe** — confined to the active phase (`sizing.py` + `test_sizing.py`); it changes no signature/DTO/schema/owner-decision and touches no frozen layer.
4. **Fixing now keeps P-SIZE *truly* complete** (closing the audit's only WARNING) so P-DATA/P-ORCH inherit a clean, exception-free sizing component rather than a latent defect.

**Not B (defer to P-ORCH):** deferral would leave the contract violation live in the current, approved-conditionally component, depend on an unbuilt layer, and contradict the audit's accepted finding. The P-ORCH data-quality non-finite rejection should **still** be added later as **defense-in-depth** — but it is the *secondary* layer, not a substitute for P-SIZE self-protection.

**Sequencing:** apply the P-SIZE hardening (≈ S effort) → re-run gates + the ~12 new tests → re-audit → then proceed to **P-DATA (Phase 2)**. Add the P-ORCH non-finite data-quality rejection during the P-ORCH build.

---

## 9. Stop Gate

**STOP.**

Remediation **architecture and audit only** — no code, no implementation, no test/schema changes. Awaiting owner authorization to apply the P-SIZE non-finite hardening (Recommendation A) before P-DATA begins.
