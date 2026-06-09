"""THUL-NURAYN v1 — Database layer.

PostgreSQL is the **source of truth**. The canonical schema lives as ordered
SQL migration files under ``thul_nurayn/db/migrations`` and is applied with any
standard runner (psql / migrate / Alembic-style). This module exposes the
ordered migration manifest for tooling and tests.
"""

from __future__ import annotations

from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def migration_files() -> list[Path]:
    """Return migration ``.sql`` files in lexical (apply) order."""
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


__all__ = ["MIGRATIONS_DIR", "migration_files"]
