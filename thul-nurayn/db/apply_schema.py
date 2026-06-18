#!/usr/bin/env python3
"""Apply the frozen D1 schema to a target PostgreSQL instance.

Usage:
    DATABASE_URL=postgresql://user:pass@host/db python db/apply_schema.py

Executes both SQL files in a single transaction:
  1. db/migrations/001_init_schema.sql
  2. db/partitions/partition_retention.sql

The SQL files are NOT modified.  This script is for fresh-database provisioning
only (B7_ARCHITECTURE_SUMMARY §4).  Upgrading an existing schema is out of v1
scope.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import psycopg2
except ImportError:
    sys.exit("ERROR: psycopg2 is required.  Install with: pip install psycopg2-binary")

_HERE = Path(__file__).parent
_SQL_FILES = [
    _HERE / "migrations" / "001_init_schema.sql",
    _HERE / "partitions" / "partition_retention.sql",
]


def apply_schema(dsn: str | None = None) -> None:
    dsn = dsn or os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("ERROR: DATABASE_URL environment variable is not set")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for path in _SQL_FILES:
                print(f"Applying {path.name} ...")
                cur.execute(path.read_text(encoding="utf-8"))
        conn.commit()
        print("Schema applied successfully.")
    except Exception as exc:
        conn.rollback()
        sys.exit(f"ERROR: Schema application failed — {exc}")
    finally:
        conn.close()


if __name__ == "__main__":
    apply_schema()
