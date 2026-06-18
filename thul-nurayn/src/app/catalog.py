"""THUL-NURAYN v1 — B9 read-only PostgreSQL catalog readers.

Backs the B8 detect-only workers with **read-only** `pg_catalog` queries
(B9_INTEGRATION_ARCHITECTURE §4; honors owner ratification A2 — detect only,
no partition creation):

  * `make_partition_exists(pool)`  -> callable(table, yyyymm) -> bool
  * `make_list_partitions(pool)`   -> callable() -> list[{table, yyyymm}]

These issue only `SELECT` against `pg_catalog`; they create/alter/drop nothing.
They are used to construct `MissingPartitionDetector` and `RetentionTierer`.

Partition naming follows the frozen D1 convention: `<table>_pYYYYMM`
(db/partitions/partition_retention.sql).
"""

from __future__ import annotations

import re
from typing import Callable

# The 6 partitioned parent tables (frozen D1 schema).
PARTITIONED_TABLES = (
    "signals", "orders", "audit_logs",
    "system_events", "market_snapshots", "risk_snapshots",
)

_PART_NAME = re.compile(r"^(?P<table>.+)_p(?P<yyyymm>\d{6})$")


def make_partition_exists(pool) -> Callable[[str, str], bool]:
    """Return a read-only `partition_exists(table, yyyymm) -> bool` for B8.

    Checks `pg_class` for a relation named `<table>_pYYYYMM`. Read-only.
    """

    def partition_exists(table: str, yyyymm: str) -> bool:
        name = f"{table}_p{yyyymm}"
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM pg_catalog.pg_class WHERE relname = %s LIMIT 1",
                    (name,),
                )
                return cur.fetchone() is not None

    return partition_exists


def make_list_partitions(pool) -> Callable[[], list]:
    """Return a read-only `list_partitions() -> list[{table, yyyymm}]` for B8.

    Lists child partitions of the 6 partitioned parents via `pg_inherits`.
    Read-only.
    """

    def list_partitions() -> list:
        sql = (
            "SELECT child.relname AS child "
            "FROM pg_catalog.pg_inherits i "
            "JOIN pg_catalog.pg_class child ON child.oid = i.inhrelid "
            "JOIN pg_catalog.pg_class parent ON parent.oid = i.inhparent "
            "WHERE parent.relname = ANY(%s)"
        )
        result: list[dict] = []
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (list(PARTITIONED_TABLES),))
                rows = cur.fetchall()
        for (child_name,) in rows:
            m = _PART_NAME.match(child_name)
            if m:
                result.append(
                    {"table": m.group("table"), "yyyymm": m.group("yyyymm")}
                )
        return result

    return list_partitions


__all__ = ["make_partition_exists", "make_list_partitions", "PARTITIONED_TABLES"]
