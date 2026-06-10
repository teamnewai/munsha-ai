# D11_OWNER_DECISIONS

**Companion to `D11_EXECUTION_TARGETS_ARCHITECTURE.md`.** Documentation only — **no code, no implementation.**
Every decision below requires owner approval **before** any D11 implementation begins. Each lists a description, alternatives, benefits, risks, and a **recommendation** (recommendations are advisory only and are not implemented).

---

## OD-1 — Default execution target
- **Description:** Which target is active when `EXECUTION_TARGET` is unset.
- **Alternatives:** (a) **Signals Only**; (b) Paper; (c) require explicit selection (fail if unset).
- **Benefits:** (a) safest, zero external deps, cannot trade; (b) exercises execution early; (c) forces an explicit choice.
- **Risks:** (b) creates orders before the owner intends; (c) friction on every startup.
- **Recommended:** **(a) Signals Only** — safest default; execution requires a deliberate mode change.

## OD-2 — Placement of the `ExecutionTarget` abstraction
- **Description:** Where the new seam lives.
- **Alternatives:** (a) **integration layer** (`src/app/targets/`, beside B9); (b) inside `src/execution` (D5); (c) a new top-level package.
- **Benefits:** (a) composition/wiring, no D5 change, honors the freeze; (b) co-located with execution; (c) clean namespace.
- **Risks:** (b) **modifies D5 (frozen)** — disallowed; (c) more surface for little gain.
- **Recommended:** **(a) integration layer** — wiring only, no D1–D10 modification.

## OD-3 — TradingView "Mode B" direction confirmation
- **Description:** Confirm Mode B is **outbound** distribution (THUL-NURAYN → TradingView), distinct from D10 inbound ingestion (TradingView → THUL-NURAYN).
- **Alternatives:** (a) **outbound distribution only** (as specified); (b) reuse D10 semantics (inbound) — would conflict with "TradingView receives signals"; (c) both directions enabled independently.
- **Benefits:** (a) matches the requirement text ("TradingView receives signals … distribution layer"); (c) maximum flexibility.
- **Risks:** (b) contradicts the stated purpose; (c) two channels to secure/operate.
- **Recommended:** **(a) outbound distribution only** for Mode B; keep D10 inbound independent and optional.

## OD-4 — Paper fill simulation policy
- **Description:** How the Paper target simulates fills (it must not change sizing/strategy).
- **Alternatives:** (a) **immediate full fill at a supplied mark/last price, no slippage**; (b) configurable partial fills; (c) a slippage/latency model.
- **Benefits:** (a) simplest, deterministic, validates wiring; (b) more realistic partials; (c) most realistic.
- **Risks:** (b)/(c) add modeling complexity that could drift toward strategy assumptions; must stay outside risk/sizing rules.
- **Recommended:** **(a) immediate full fill at a supplied mark, no slippage** for the first paper phase; revisit realism later via versioned approval.

## OD-5 — Paper vs live row differentiation (no schema change)
- **Description:** How paper, live, and (future) IBKR rows are distinguished in the shared `orders`/`positions`/`fills` tables.
- **Alternatives:** (a) **`broker_ref` prefix convention** (`paper:` / `ibkr:`) + audited active mode; (b) a new `mode`/`source` column (schema change); (c) separate tables per mode (schema change).
- **Benefits:** (a) no schema change, honors the freeze, audit-complete; (b)/(c) explicit typing.
- **Risks:** (a) convention discipline required in queries/reports; (b)/(c) **schema change** → versioned approval, breaks current freeze.
- **Recommended:** **(a) `broker_ref` convention + audit mode tag** now; defer (b) to a future versioned schema decision if explicit typing is later needed.

## OD-6 — Subscription entitlement source
- **Description:** Where the subscription capability that gates the active target comes from.
- **Alternatives:** (a) **config/governance input** now; (b) a full subscription/billing system (future); (c) hard-coded single tier.
- **Benefits:** (a) no new system, fail-closed gating works immediately; (b) productized; (c) trivial.
- **Risks:** (b) large scope, out of current phase; (c) inflexible.
- **Recommended:** **(a) config/governance entitlement** now; full subscription system is a future versioned phase.

## OD-7 — Multi-broker cardinality
- **Description:** Whether more than one broker/target can be active at once.
- **Alternatives:** (a) **one active target per process** now; (b) multi-broker routing now.
- **Benefits:** (a) simple, matches single-process synchronous stack; (b) flexibility.
- **Risks:** (b) routing/ordering complexity, premature for v-now; the seam already allows it as a future additive target.
- **Recommended:** **(a) one active target per process**; multi-broker routing is a future additive capability (no D5/schema change required to add later).

## OD-8 — Interactive Brokers adapter scope & timing
- **Description:** When/whether to build the IBKR `BrokerSyncContract` adapter.
- **Alternatives:** (a) **definition only now**, build in a future owner-gated phase after a successful paper period; (b) build the adapter now; (c) never (paper-only product).
- **Benefits:** (a) staged, lowest risk; (b) fastest path to live; (c) zero broker risk.
- **Risks:** (b) live-trading risk before paper validation + violates "no implementation"; (c) no live trading.
- **Recommended:** **(a) definition only now**; implement IBKR later via formal architecture review + versioned approval, only after paper validation.

## OD-9 — Mode-change governance (when can the active target change)
- **Description:** Whether the execution target may change at runtime or only at controlled times.
- **Alternatives:** (a) **only at startup / before session, forward-only** (consistent with `B9_OWNER_POLICY_UPDATE` capital-change windows); (b) runtime hot-switch; (c) only via redeploy.
- **Benefits:** (a) safe, auditable, governance-consistent; (c) maximal control.
- **Risks:** (b) switching execution mode mid-session is high-risk and could orphan in-flight orders; (c) operationally heavy.
- **Recommended:** **(a) change only before session start (or via restart), forward-only**, mirroring the capital/allocation governance policy; never mid-session.

## OD-10 — Do Signals/TradingView modes create `Order` rows?
- **Description:** Whether non-execution modes persist `Order` rows or stop at `Signal`.
- **Alternatives:** (a) **stop at `Signal`** (no orders without execution intent); (b) create `Order` rows in a non-executed state.
- **Benefits:** (a) keeps `orders` meaningful (an order implies intent to execute), cleaner reporting; (b) uniform pipeline shape across modes.
- **Risks:** (b) orders that are never executed pollute the orders table and duplicate-protection space; (a) slightly different pipeline tail per mode.
- **Recommended:** **(a) stop at `Signal`** for Signals Only / TradingView; create orders only in execution modes (Paper/IBKR).

## OD-11 — Outbound notification channel for TradingView Mode
- **Description:** The transport for outbound distribution (Mode B).
- **Alternatives:** (a) TradingView-supported inbound webhook/email/format; (b) generic webhook/notification abstraction with TradingView as one sink; (c) defer until Mode B is scheduled.
- **Benefits:** (b) keeps TradingView optional and swappable; (c) avoids premature design.
- **Risks:** (a) couples to one provider; (c) Mode B unspecified until later.
- **Recommended:** **(b) a generic notification-sink abstraction** (TradingView as one optional sink), defined when Mode B is scheduled — keeps the core TradingView-independent.

---

## Summary Table

| # | Decision | Recommendation |
|---|----------|----------------|
| OD-1 | Default target | Signals Only |
| OD-2 | Abstraction placement | Integration layer (`src/app/targets/`) |
| OD-3 | Mode B direction | Outbound distribution only (distinct from D10) |
| OD-4 | Paper fill policy | Immediate full fill at supplied mark, no slippage |
| OD-5 | Paper/live differentiation | `broker_ref` convention + audit (no schema change) |
| OD-6 | Subscription entitlement | Config/governance now; full system future |
| OD-7 | Multi-broker cardinality | One active target/process now |
| OD-8 | IBKR adapter | Definition only now; future owner-gated build |
| OD-9 | Mode-change governance | Before-session/restart, forward-only |
| OD-10 | Orders in non-exec modes | Stop at Signal (no orders) |
| OD-11 | TradingView outbound channel | Generic notification-sink abstraction |

---

## Stop Gate

**STOP.**

These are owner decisions only — none is implemented. Architecture documents `D11_EXECUTION_TARGETS_ARCHITECTURE.md` and `D11_OWNER_DECISIONS.md` are complete. Await owner rulings on **OD-1…OD-11** and approval of the D11 architecture before any implementation begins.
