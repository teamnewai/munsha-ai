"""THUL-NURAYN v1 — B7 PostgreSQL connection pool.

Provides:
  * ConnectionPool — psycopg2 ThreadedConnectionPool; env-based config;
    fail-safe startup health check; thread-local transaction tracking.

Config env vars:
  DATABASE_URL   — full DSN (required)
  DB_POOL_MIN    — minimum pool size (default 1)
  DB_POOL_MAX    — maximum pool size (default 10)
"""

from __future__ import annotations

import os
import threading
from contextlib import contextmanager
from typing import Iterator

import psycopg2
import psycopg2.extras
import psycopg2.pool

from .errors import PersistenceError


class ConnectionPool:
    """Synchronous psycopg2 connection pool with thread-local transaction tracking."""

    def __init__(
        self,
        dsn: str | None = None,
        min_conn: int = 1,
        max_conn: int = 10,
    ) -> None:
        dsn = dsn or os.environ.get("DATABASE_URL")
        if not dsn:
            raise PersistenceError("DATABASE_URL is not set")
        min_conn = int(os.environ.get("DB_POOL_MIN", min_conn))
        max_conn = int(os.environ.get("DB_POOL_MAX", max_conn))

        try:
            self._pool = psycopg2.pool.ThreadedConnectionPool(min_conn, max_conn, dsn)
        except Exception as exc:
            raise PersistenceError(f"Cannot create connection pool: {exc}") from exc

        # Startup health check — fail fast if DB is unreachable
        try:
            conn = self._pool.getconn()
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            self._pool.putconn(conn)
        except Exception as exc:
            self._pool.closeall()
            raise PersistenceError(
                f"PostgreSQL health check failed: {exc}"
            ) from exc

        # Register UUID adapter so UUID columns come back as uuid.UUID objects
        psycopg2.extras.register_uuid()

        self._local = threading.local()

    # -- connection acquisition -------------------------------------------- #

    @contextmanager
    def connection(self) -> Iterator:
        """Yield a psycopg2 connection.

        If a transaction is active on this thread (set by transaction()), yield
        that shared connection without committing or returning it to the pool.
        Otherwise acquire a standalone connection, commit on success, rollback
        on exception, and return it to the pool.
        """
        active = getattr(self._local, "conn", None)
        if active is not None:
            # Participate in the active transaction — no commit/rollback here.
            yield active
            return

        conn = self._pool.getconn()
        conn.autocommit = False
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)

    @contextmanager
    def transaction(self) -> Iterator:
        """BEGIN/COMMIT/ROLLBACK context for the current thread.

        Stores the active connection in a thread-local so that all repository
        operations on this thread join the same transaction.  On exception the
        transaction is rolled back and the exception re-raises.
        """
        conn = self._pool.getconn()
        conn.autocommit = False
        self._local.conn = conn
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._local.conn = None
            self._pool.putconn(conn)

    def close(self) -> None:
        """Close all connections in the pool."""
        self._pool.closeall()


__all__ = ["ConnectionPool"]
