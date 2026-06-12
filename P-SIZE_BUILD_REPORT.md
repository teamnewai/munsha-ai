# P-SIZE_BUILD_REPORT

**Phase executed:** P-SIZE — Position Sizing (Phase 1 of the authorized implementation order).
**Authorization:** Implementation Authorization Granted; architecture FROZEN; build P-SIZE only.
**Implemented exactly per:** `P-SIZE_ARCHITECTURE.md`.
**Result:** ✅ Complete. **321 passed · 24 skipped** (296 prior + **25 new P-SIZE tests**). Lint clean (ruff + flake8); `sizing.py` mypy-clean.
**Footprint:** **purely additive** — `src/app/sizing.py` + `tests/test_sizing.py`. **No frozen file modified** (D1–D14A + P-DATA/P-ORCH contracts + existing `src/app/*` untouched; verified by path-filtered `git diff` → empty).

---

## 1. Files Changed

| File | Type | Purpose |
|------|------|---------|
| `thul-nurayn/src/app/sizing.py` | **New** | `CapitalSettings`, `SizingResult`, `SizingPolicy` — fixed-allocation sizing |
| `thul-nurayn/tests/test_sizing.py` | **New** | 25 P-SIZE tests |

No existing source/test/schema file was modified.

## 2. What Was Built

- **`SizingPolicy.size(candidate, settings, mark) -> SizingResult`** — pure, deterministic, stateless. Quantity derived **solely** from `{capital, allocation_fraction, mark}`: `quantity = floor(capital × allocation_fraction ÷ mark)` (whole shares).
- **`CapitalSettings`** — owner capital + allocation fraction; `from_env()` reads `STARTING_CAPITAL` (pre-existing) + `POSITION_ALLOCATION_FRACTION` (approved Position-Allocation setting); raises on missing/unparseable config.
- **`SizingResult`** — transient `{quantity, tradable, reason, capital_base, allocation_value}` with a `no_trade(reason)` helper.

## 3. Requirement Compliance (owner P-SIZE requirements)

| Requirement | Status |
|-------------|--------|
| Implement exactly as approved | ✅ matches `P-SIZE_ARCHITECTURE.md` §2 signature/formula |
| Fixed-allocation only | ✅ `floor(capital×fraction÷mark)` |
| Non-compounding base capital | ✅ base = owner-configured capital; no equity/profit input exists |
| Quantity from Capital + Allocation + Price only | ✅ no other input consumed (signature + tests) |
| No Kelly / volatility / ATR / risk-based / dynamic sizing | ✅ none present (signature + import scan) |
| Missing mark / invalid capital / invalid allocation / unaffordable → No Trade w/ reason | ✅ each returns `tradable=False`, `quantity=0`, explicit `reason` |
| Never fabricate price or quantity | ✅ No-Trade paths return `quantity=0`; no default/synthetic value |

## 4. Quality Gates

| Gate | Result |
|------|--------|
| ruff (lint) | ✅ All checks passed |
| flake8 (lint) | ✅ clean |
| mypy (type) on `sizing.py` | ✅ `Success: no issues found in 1 source file` |
| pytest (full suite) | ✅ **321 passed, 24 skipped** |
| New tests | ✅ 25 (`test_sizing.py`) |
| Freeze (frozen files unchanged) | ✅ additive only; diff empty over D1–D14A/P-DATA/P-ORCH/existing app |

> mypy over transitive imports surfaces 55 **pre-existing** errors in frozen B7/B9 files (`persistence/dal.py`, `app/bootstrap.py`) — **not introduced by P-SIZE** and **not modified** (frozen). `sizing.py` itself is type-clean in isolation.

## 5. Assumptions

1. **Additive only** — `src/app/sizing.py`; B9's `app/__init__.py` is **not** modified (P-SIZE imported directly), keeping every audited surface frozen.
2. **`candidate` is contextual** (architecture signature); the arithmetic uses only `{capital, allocation, mark}` (req 13).
3. **`STARTING_CAPITAL`** is the pre-existing owner-capital env (B9 OD-D1); **`POSITION_ALLOCATION_FRACTION`** is the implementation key for the approved Position-Allocation setting (`B9_OWNER_POLICY_UPDATE`) — exact key name flagged for confirmation (OD-PSIZE-3).
4. **Non-compounding** — base is configured capital, not equity (profit governance).
5. **Settings-editing window** (outside market hours) is the settings layer's concern (future); P-SIZE only **reads** current approved values.
6. **No persistence/audit by P-SIZE** — the Sizing audit event is emitted by P-ORCH using P-SIZE's `reason`.

## 6. Remaining Risks

- **R1 — `POSITION_ALLOCATION_FRACTION` key name** is an implementation choice (the *setting* is approved; the *env key* is not pinned in architecture). Owner confirmation requested (OD-PSIZE-3). Low risk; trivially renamable.
- **R2 — Settings change-window not enforced here** (by design): a durable settings store + off-hours-only editing enforcement remains a future feature; until then, capital/allocation are env-config and the change-window is an operational discipline.
- **R3 — Allocation expressed as a fraction** (OD-PSIZE-1 recommended). If the owner later wants an absolute per-trade amount, a small additive extension is needed.
- **R4 — 70/30 Core/Turbo** remains monitoring-only (D6); per-engine bucket sizing is **not** implemented (would be an allocation-policy change — OD-PSIZE-5).
- None of these block the next phases; none affects frozen behavior.

## 7. Gate

**P-SIZE is COMPLETE.** Phase 1 done. **P-DATA and P-ORCH NOT started.**
Accompanying: `P-SIZE_CONTRACT_MAPPING.md`, `P-SIZE_ARCHITECTURE_COMPLIANCE_REPORT.md`, `P-SIZE_TEST_RESULTS.md`.

**STOP — awaiting approval.**
