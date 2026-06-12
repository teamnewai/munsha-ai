# D12_TRADINGVIEW_OUTBOUND_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No tests. No implementation. No source changes. No schema changes.**
**Derived from:** approved B1–B9 artifacts · `D10_TRADINGVIEW_INTEGRATION_ARCHITECTURE.md` · `D11_EXECUTION_TARGETS_ARCHITECTURE.md` · `D11_OWNER_DECISIONS.md` / `…_REVIEW.md` · `D11_BUILD_REPORT.md` / `D11_AUDIT.md` · `B9_OWNER_POLICY_UPDATE.md` · `IP_PROTECTION_REPORT.md`.
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** D12 — TradingView **outbound** publishing (the optional execution target D11 deferred via `OD-11`/`OD-3`).

**Invariants preserved throughout:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no broker connectivity** · no new tables · no new enums · no schema changes · **no modifications to D1–D11** · TradingView is **optional**; **Signals Only remains the default**; **Paper Trading remains available**.

---

## 1. Purpose

D12 lets THUL-NURAYN **publish already-approved signals outward to TradingView** (or a relay), realizing the TradingView execution target that D11 explicitly left unimplemented (`selection.NOT_IMPLEMENTED=("ibkr","tradingview")`).

TradingView is a **display/distribution destination only**. It receives a finished result; it computes nothing. All intelligence — scanning (D3 scoring), risk gating (D4), execution (D5) — stays inside THUL-NURAYN exactly as built.

---

## 2. Core Principles (requirements 1–9)

| # | Requirement | Commitment |
|---|-------------|------------|
| 1 | TradingView outbound only | Data flows **THUL-NURAYN → TradingView**. No inbound path here (inbound ingestion is the separate, independent D10). |
| 2 | No strategy logic in TradingView | The outbound message is a **published result**; TradingView never scores, gates, sizes, or executes. |
| 3 | No duplication of Selection logic | D12 publishes a signal **already scored by D3**; it re-runs no scanning/scoring/ranking. |
| 4 | No duplication of Risk logic | D12 publishes only signals **already accepted by D4**; it re-runs no gates. |
| 5 | No duplication of Execution logic | D12 **does not execute** — `executes()=False`; it creates no orders and touches no broker. |
| 6 | Preserve D1–D11 invariants | New additive target + a notification-sink seam; no prior layer modified; PostgreSQL truth; separation intact. |
| 7 | TradingView optional execution target | A selectable `ExecutionTarget` (`name()=="tradingview"`), off unless explicitly chosen. |
| 8 | Signals Only remains default | `EXECUTION_TARGET` default stays `"signals"` (D11 OD-1); D12 changes no default. |
| 9 | Paper Trading remains available | Paper target unchanged and still selectable. |

---

## 3. Position in the Architecture

```
   D3 Score → D4 Risk (decide)              [UNCHANGED CORE — single source of truth]
                  │ accepted signal (ExecutionIntent)
                  ▼
        ┌───────────────────────────────────────┐
        │ D11 ExecutionTarget (one active/proc)  │
        ├───────────────────────────────────────┤
        │ SignalsOnlyTarget  (default)           │
        │ PaperTarget        (available)         │
        │ TradingViewTarget  (D12, optional) ────┼──► NotificationSink (D12 seam, OD-11)
        └───────────────────────────────────────┘            │ outbound publish
                  │ executes()=False (no order, no broker)    ▼
                  ▼                                   ┌──────────────────┐
        Signal persisted (PostgreSQL = truth)        │ TradingViewSink  │ HTTPS POST (signed)
        Audit: system_events GatewayEvent            │ (one sink impl)  │──► TradingView / relay
                                                      └──────────────────┘
```

- **`TradingViewTarget`** is `SignalsOnly` behavior **plus** an outbound publish: it stops at the approved signal (no order, no broker — D11 OD-10) and emits the signal to a **`NotificationSink`**.
- **`NotificationSink`** (the D11 OD-11 generic seam) keeps the core TradingView-independent; TradingView is **one** sink implementation.
- D12 sits at the **integration layer** (`src/app/targets/`, beside D11), additive only.

---

## 4. Outbound Message Format (requirement 10)

A minimal JSON envelope carrying a **published result**, not strategy internals:

```jsonc
{
  "schema_version": "1",
  "event": "signal.published",
  "signal_id": "…uuid",            // correlation / idempotency key
  "published_at": "2026-06-10T14:32:05Z",  // ISO-8601 UTC
  "symbol": "AAPL",
  "market": "NASDAQ",              // existing Market enum value
  "engine": "Core",               // existing EngineType value
  "direction": "Long",            // existing Direction value
  "classification": "Golden",     // OPTIONAL display band (see OD-D12-2 / IP note)
  "source": "thul-nurayn"
}
```

**Rules:**
- Values reuse existing enum spellings (`Market`/`EngineType`/`Direction`); **no new enum**.
- The envelope is **derived from a persisted `Signal`** (and its D3 `Score`); D12 computes nothing.
- **IP protection:** the **raw numeric score and per-component breakdown are NOT published** by default — at most a coarse `classification` band, and only if the owner opts in (OD-D12-2). This avoids leaking the proprietary scoring formula (per `IP_PROTECTION_REPORT.md`).
- The signature/auth material travels in a header or a dedicated field, not mixed into the result body (§5).
- No secrets, no credentials, no internal identifiers beyond `signal_id` appear in the payload.

---

## 5. Authentication Model (requirement 11)

Outbound = **THUL-NURAYN authenticates to the TradingView receiver/relay**.

| Control | Design |
|---------|--------|
| Transport | **HTTPS/TLS only**; plaintext refused. |
| Integrity/auth | **HMAC-SHA256** over the raw body (header, e.g. `X-TN-Signature`) **and/or** a bearer token per the receiver's contract; whichever the endpoint supports. |
| Secret storage | Token/secret + endpoint URL in **environment / secret manager only** — never in code, git, or logs (consistent with B7/B8/D10/D11). Redacted by the B8 logging layer. |
| Endpoint | A configured webhook URL (`TRADINGVIEW_OUTBOUND_URL`); may be non-guessable; a relay/proxy may sit in front if TradingView's native inbound auth is insufficient. |
| Direction | Outbound only — D12 never exposes an inbound surface (that is D10). |
| Least privilege | The sink can only POST published results; it cannot read or mutate THUL-NURAYN state. |

> TradingView's native inbound webhooks have limited auth; **OD-D12-3** covers direct-vs-relay. The architecture is relay-agnostic: auth is enforced at whatever endpoint receives the POST.

---

## 6. Failure Handling (requirement 12)

Publishing is **best-effort and non-fatal** — TradingView is optional and never authoritative.

| Condition | Response |
|-----------|----------|
| Sink/network/timeout error | **Non-fatal.** The signal is already durably persisted (PostgreSQL); the trading decision path is unaffected. Failed publish → **B8 DLQ** + alert. |
| Auth rejected by receiver | Non-fatal; DLQ + `Warning`/`Critical` alert; operator investigates credentials. |
| Endpoint/secret misconfigured at startup | `startup_check()` reports **degraded**; the target still runs (signals persist; publishes are dead-lettered) — does **not** block startup. |
| PostgreSQL unreachable | Handled upstream (B7/B9 fail-safe); D12 never compensates by treating TradingView as truth. |
| Malformed/over-size payload | Rejected before send; logged; DLQ. |

**Principle:** a publishing failure **never** blocks, delays, or alters a trade decision, and **never** loses the durable signal. (TradingView mode itself creates no orders — D11 OD-10.)

---

## 7. Retry Policy (requirement 13)

**Default (preserves the D1–D11 invariant): NO automatic retry.** A failed outbound publish is **dead-lettered** (B8 DLQ); an operator **manually re-publishes** (idempotent by `signal_id`) after fixing the cause. This is consistent with the project-wide "no automatic retry; manual DLQ resolution" rule (B5/B7/B8/B9).

**Owner option (OD-D12-1):** because outbound notifications are non-authoritative, idempotent (keyed by `signal_id`), and touch no money/state, the owner *may* permit a **bounded, idempotent retry** (e.g., small fixed count with backoff) **for the TradingView sink only**, after which the item is dead-lettered. This is the **only** place a bounded retry could be considered without contradicting the execution/persistence fail-safe model — and it remains an explicit owner decision, defaulting to **no auto-retry**.

Idempotency guarantee (either way): the receiver de-duplicates on `signal_id`, so a manual or bounded re-publish cannot create duplicate downstream effects (and there are no orders to duplicate — `executes()=False`).

---

## 8. Audit Trail (requirement 14)

- Each publish attempt is recorded as a **`system_events` row with `event_type = GatewayEvent`** (existing member — the same pattern B8 used for the DLQ and D10 used for inbound), with `detail` JSONB `{signal_id, sink:"tradingview", outcome:"published"|"failed", reason, attempt}`. **No new enum, no new table.**
- Outbound publishing writes **no domain rows** (no orders/positions/fills) — TradingView mode creates none.
- The published `Signal` itself remains the durable artifact in PostgreSQL; the audit trail records the distribution lifecycle separately and append-only.
- Failed publishes additionally appear in the **B8 DLQ** (a `WorkerFailure` `system_events` row) for operator resolution.
- Secrets are redacted from all audit/log output.

---

## 9. Preserved D1–D11 Invariants (requirement 6)

| Invariant | How D12 preserves it |
|-----------|----------------------|
| PostgreSQL sole source of truth | Signals/audit persist via the existing DAL; TradingView is a downstream copy, never authoritative. |
| Redis non-authoritative | D12 does not rely on Redis for correctness. |
| Score Engine single source of truth | D12 publishes a D3 result; it never scores. |
| Portfolio ⟂ Risk ⟂ Execution | D12 acts after D4 accept; no scoring/risk/portfolio/execution logic. |
| No broker connectivity | TradingView is a notification endpoint, not a broker; `executes()=False`; no orders. |
| No new tables/enums/schema | Reuses `signals` + existing enums + `system_events` `GatewayEvent`. |
| No D1–D11 modification | Additive `TradingViewTarget` + `NotificationSink` seam (see OD-D12-4 on registration). |
| Default = Signals Only; Paper available | D12 changes no defaults and removes nothing. |
| Fail-safe; no auto-retry (default) | Failures → DLQ; manual re-publish. |
| No secrets in code/git/logs | Outbound secret/URL via env; redacted. |
| IP protection | Raw score/breakdown not published by default. |

---

## 10. Dependencies

**D12 depends on:** D1 (`Signal`/`Score`/enums), D2 (DAL — read the persisted signal/score), D3 (the score already computed — read only), D11 (`ExecutionTarget` abstraction + `SignalsOnly` behavior it extends), B8 (alerting, DLQ, `system_events`).
**D12 does not depend on:** any broker, IBKR, D5 execution path (it does not execute), or a UI. The **core remains TradingView-independent** (the sink is a plug-in behind the `NotificationSink` seam).
**New (implementation-time, owner-gated) dependency:** an outbound HTTPS client for the TradingView/relay POST — introduced only at implementation, not now.

---

## 11. Assumptions

1. **D12 is additive at the integration layer** (`src/app/targets/`), analogous to D11; it introduces `TradingViewTarget` + a `NotificationSink` abstraction (D11 OD-11) and modifies no prior layer.
2. **TradingView mode does not execute** (`executes()=False`): approved signals are published; no orders/positions/fills are created (D11 OD-10) — so there is nothing to duplicate.
3. **Published payload is derived from persisted data**; D12 computes nothing. Raw scores are withheld by default (IP).
4. **Best-effort, non-fatal publishing**; the durable signal and the decision path are never affected by a publish failure.
5. **No automatic retry by default**; bounded idempotent retry is an explicit owner option for the outbound sink only (OD-D12-1).
6. **Idempotency by `signal_id`** at the receiver makes re-publishes safe.
7. **Outbound endpoint + secret are env-supplied**; a relay may front TradingView; auth is enforced at the receiving endpoint.
8. **One active target per process** (D11 OD-7): TradingView mode is publish-only; combining publishing with Paper/execution (multi-sink on any target) is a **future** capability via the `NotificationSink` seam, not built here.

---

## 12. Owner Decisions Required

| # | Decision | Alternatives | Recommended |
|---|----------|--------------|-------------|
| **OD-D12-1** | Retry policy for the outbound sink | (a) **no auto-retry → DLQ** (invariant-consistent); (b) bounded idempotent retry then DLQ | **(a)** default; (b) only if the owner explicitly wants it for the non-authoritative sink |
| **OD-D12-2** | Publish `classification`/score? | (a) **symbol/market/engine/direction only**; (b) + coarse `classification` band; (c) + numeric score | **(a) or (b)**; **never (c)** (protects scoring IP) |
| **OD-D12-3** | Direct TradingView vs relay/proxy | (a) direct webhook; (b) **relay/proxy** with stronger auth | **(b)** if direct auth is insufficient; decide at implementation |
| **OD-D12-4** | Target registration mechanism | (a) extend D11 `selection` to move `"tradingview"` into IMPLEMENTED (small additive edit, versioned); (b) a pluggable target-registry seam so new targets register without editing D11 | **(b) registry seam** (keeps D11 frozen); else (a) under versioned approval |
| **OD-D12-5** | NotificationSink scope now | (a) **single TradingView sink** now; (b) generic multi-sink fan-out now | **(a)** now; (b) future (consistent with D11 OD-7/OD-11 deferral) |
| **OD-D12-6** | Publish trigger point | (a) **on D4-accept in TradingView mode**; (b) also from other modes (multi-sink) | **(a)** now; (b) future |

---

## 13. Definition of Done (requirement 15)

1. `TradingViewTarget` (`ExecutionTarget`, `name()=="tradingview"`, **`executes()=False`**) defined at the integration layer; extends Signals-Only behavior (stops at signal, no order) and publishes via a `NotificationSink`.
2. `NotificationSink` abstraction (D11 OD-11) defined; **`TradingViewSink`** is one implementation; core stays TradingView-independent.
3. **Outbound message format** specified (§4); reuses existing enums; raw score withheld by default (IP).
4. **Authentication model** specified (§5): HTTPS + HMAC/bearer; secret/URL via env; redacted.
5. **Failure handling** specified (§6): non-fatal; durable signal preserved; failures → DLQ + alert; never blocks decisions.
6. **Retry policy** specified (§7): default **no auto-retry → DLQ**; bounded idempotent retry only via OD-D12-1.
7. **Audit trail** specified (§8): `system_events` `GatewayEvent` per attempt; DLQ on failure; no new enum/table.
8. **Invariants preserved**: PostgreSQL truth · Redis non-authoritative · Score Engine authoritative · Portfolio ⟂ Risk ⟂ Execution · no broker · Signals-Only default · Paper available · no new tables/enums/schema · no D1–D11 modification.
9. **No duplication** of selection/risk/execution logic; TradingView computes nothing.
10. Owner decisions OD-D12-1…6 resolved; registration mechanism (OD-D12-4) chosen to keep D11 frozen.
11. Tests (at implementation) cover: publish success, publish failure → DLQ, auth header construction, idempotent re-publish, payload format/IP redaction, `executes()=False` (no orders), and target selection.
12. `D12_BUILD_REPORT.md` produced; stop at the D12 gate.

---

## 14. Out of Scope

- Any inbound TradingView path (that is D10).
- Any order/broker/execution (TradingView mode `executes()=False`).
- IBKR, multi-broker, subscription enforcement (D11 deferrals stand).
- Multi-sink fan-out / publishing from non-TradingView modes (future via the sink seam).
- API/UI; new tables/enums/schema; modification of D1–D11.

---

## 15. Stop Gate (requirement 16)

**STOP.**

Architecture only — no code, no tests, no implementation, no source/schema changes, no modification to D1–D11. Await owner review and rulings on **OD-D12-1…OD-D12-6** (notably the retry policy and the D11-freeze-preserving registration mechanism) before any D12 implementation begins.
