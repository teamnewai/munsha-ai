# THUL-NURAYN — V2 BACKLOG

Strategic changes are **forbidden in v1** (FROZEN). Anything that would alter
strategy, risk, scoring, execution rules, architecture, database design, API
contracts, indicators, trading logic, or risk rules is rejected from v1 and
recorded here as a `V2_BACKLOG_ITEM`.

## Format

```
### V2-NNN — <title>
- Type: Strategy | Risk | Score | Execution | Architecture | DB | API | Indicator | Logic
- Raised: YYYY-MM-DD
- Source: <who/what raised it>
- Description: <what is being proposed>
- Reason rejected from v1: <which frozen rule it violates>
- Disposition: BACKLOGGED
```

## Items

_(none yet)_

---

> Note: The reconstruction of enum members, column shapes, index choices,
> partition keys, and retention windows performed during D1 are **derived
> assumptions**, not strategic changes. They are tracked in
> `D1_FOUNDATION_REPORT.md` → "Issues Found" for reconciliation against the
> authoritative Master Specification, and are **not** V2 backlog items.
