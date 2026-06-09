"""THUL-NURAYN v1 — Foundation package (D1).

A quantitative-trading system foundation: domain models, shared enums,
validation, configuration, logging, and the Redis operational layer. The
durable source of truth is PostgreSQL, defined by the DDL under
``thul_nurayn/db/migrations``.

D1 is FOUNDATION ONLY — no scanner/ranking/score/risk/execution/portfolio
logic is implemented here.
"""

__version__ = "1.0.0"
