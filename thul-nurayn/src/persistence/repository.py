"""THUL-NURAYN v1 — B7 PostgreSQL repository implementations.

Components:
  PostgresRepository[T]     — concrete Repository[T] ABC against PostgreSQL.
  PostgresBridgeRepository  — composite-key persistence for signal_news /
                               signal_earnings bridge tables.

Both are drop-in replacements for InMemoryRepository / BridgeRepository.
No caller changes are required; both implement the same public interfaces.

_snapshot() and _restore() are no-ops: the DataAccessLayer.transaction()
override in PostgresDataAccessLayer manages atomicity via BEGIN/COMMIT/ROLLBACK.
"""

from __future__ import annotations

import dataclasses
import logging
from typing import Any, Generic, Optional, TypeVar

import psycopg2
import psycopg2.errors
import psycopg2.extras

from src.data_access.errors import DuplicateEntity, EntityNotFound, ImmutableViolation
from src.data_access.repository import Repository
from src.data_access.validation import validate_filter_fields

from .errors import PersistenceError
from .serialization import entity_to_row, row_to_entity, serialize_value

log = logging.getLogger(__name__)

T = TypeVar("T")


class PostgresRepository(Repository[T]):
    """Synchronous psycopg2-backed implementation of Repository[T].

    All seven CRUD operations map to SQL against the named table.
    Append-only enforcement happens in Python before any SQL is issued.
    UniqueViolation is mapped to DuplicateEntity; missing rows raise EntityNotFound.
    """

    def __init__(
        self,
        entity_type: type,
        pool: Any,
        table_name: str,
        *,
        id_attr: str = "id",
        append_only: bool = False,
    ) -> None:
        self.entity_type = entity_type
        self._pool = pool
        self._table = table_name
        self._id_attr = id_attr
        self.append_only = append_only
        self._fields: list[str] = [f.name for f in dataclasses.fields(entity_type)]

    # -- CRUD ---------------------------------------------------------------- #

    def add(self, entity: T) -> T:
        row = entity_to_row(entity)
        cols = self._fields
        placeholders = ", ".join(["%s"] * len(cols))
        sql = (
            f"INSERT INTO {self._table} ({', '.join(cols)}) "
            f"VALUES ({placeholders})"
        )
        values = [row[c] for c in cols]
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, values)
        except psycopg2.errors.UniqueViolation as exc:
            raise DuplicateEntity(
                f"{self.entity_type.__name__} already exists"
            ) from exc
        except psycopg2.Error as exc:
            raise PersistenceError(f"add({self._table}) failed: {exc}") from exc
        return entity

    def get(self, entity_id: Any) -> T:
        entity = self.get_or_none(entity_id)
        if entity is None:
            raise EntityNotFound(
                f"{self.entity_type.__name__} id={entity_id} not found"
            )
        return entity

    def get_or_none(self, entity_id: Any) -> Optional[T]:
        sql = f"SELECT * FROM {self._table} WHERE {self._id_attr} = %s LIMIT 1"
        try:
            with self._pool.connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(sql, (entity_id,))
                    row = cur.fetchone()
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"get_or_none({self._table}) failed: {exc}"
            ) from exc
        if row is None:
            return None
        return row_to_entity(self.entity_type, dict(row))

    def list(self, **filters: Any) -> list[T]:
        validate_filter_fields(self.entity_type, filters)
        where_parts: list[str] = []
        values: list[Any] = []
        for col, val in filters.items():
            if val is None:
                where_parts.append(f"{col} IS NULL")
            else:
                where_parts.append(f"{col} = %s")
                values.append(serialize_value(val))
        where_clause = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""
        sql = f"SELECT * FROM {self._table}{where_clause}"
        try:
            with self._pool.connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(sql, values or None)
                    rows = cur.fetchall()
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"list({self._table}) failed: {exc}"
            ) from exc
        return [row_to_entity(self.entity_type, dict(r)) for r in rows]

    def update(self, entity: T) -> T:
        if self.append_only:
            raise ImmutableViolation(
                f"{self.entity_type.__name__} is append-only; update not permitted"
            )
        entity_id = getattr(entity, self._id_attr)
        row = entity_to_row(entity)
        update_cols = [c for c in self._fields if c != self._id_attr]
        set_parts = [f"{c} = %s" for c in update_cols]
        values = [row[c] for c in update_cols] + [entity_id]
        sql = (
            f"UPDATE {self._table} "
            f"SET {', '.join(set_parts)} "
            f"WHERE {self._id_attr} = %s"
        )
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, values)
                    if cur.rowcount == 0:
                        raise EntityNotFound(
                            f"{self.entity_type.__name__} id={entity_id} not found"
                        )
        except EntityNotFound:
            raise
        except psycopg2.errors.UniqueViolation as exc:
            raise DuplicateEntity(
                f"{self.entity_type.__name__} unique constraint violated on update"
            ) from exc
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"update({self._table}) failed: {exc}"
            ) from exc
        return entity

    def delete(self, entity_id: Any) -> None:
        if self.append_only:
            raise ImmutableViolation(
                f"{self.entity_type.__name__} is append-only; delete not permitted"
            )
        sql = f"DELETE FROM {self._table} WHERE {self._id_attr} = %s"
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, (entity_id,))
                    if cur.rowcount == 0:
                        raise EntityNotFound(
                            f"{self.entity_type.__name__} id={entity_id} not found"
                        )
        except EntityNotFound:
            raise
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"delete({self._table}) failed: {exc}"
            ) from exc

    def count(self, **filters: Any) -> int:
        validate_filter_fields(self.entity_type, filters)
        where_parts: list[str] = []
        values: list[Any] = []
        for col, val in filters.items():
            if val is None:
                where_parts.append(f"{col} IS NULL")
            else:
                where_parts.append(f"{col} = %s")
                values.append(serialize_value(val))
        where_clause = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""
        sql = f"SELECT COUNT(*) FROM {self._table}{where_clause}"
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, values or None)
                    result = cur.fetchone()
                    return int(result[0])
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"count({self._table}) failed: {exc}"
            ) from exc

    # -- transaction support (no-ops; DB transaction managed by PostgresDataAccessLayer) #

    def _snapshot(self) -> None:
        return None

    def _restore(self, snapshot: None) -> None:
        pass


class PostgresBridgeRepository(Generic[T]):
    """Composite-key PostgreSQL store for bridge tables (signal_news, signal_earnings).

    Mirrors the BridgeRepository interface: add / get_or_none / list / delete / count.
    No update (bridge rows are link records only).
    """

    def __init__(
        self,
        entity_type: type,
        pool: Any,
        table_name: str,
        key_fields: tuple[str, str],
    ) -> None:
        self.entity_type = entity_type
        self._pool = pool
        self._table = table_name
        self._key_fields = key_fields
        self._fields: list[str] = [f.name for f in dataclasses.fields(entity_type)]

    def _key_where(self, key: tuple) -> tuple[str, list]:
        where = " AND ".join(f"{f} = %s" for f in self._key_fields)
        return where, list(key)

    def add(self, entity: T) -> T:
        row = entity_to_row(entity)
        cols = self._fields
        placeholders = ", ".join(["%s"] * len(cols))
        sql = (
            f"INSERT INTO {self._table} ({', '.join(cols)}) "
            f"VALUES ({placeholders})"
        )
        values = [row[c] for c in cols]
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, values)
        except psycopg2.errors.UniqueViolation as exc:
            raise DuplicateEntity(
                f"{self.entity_type.__name__} link already exists"
            ) from exc
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"bridge add({self._table}) failed: {exc}"
            ) from exc
        return entity

    def get_or_none(self, *key: Any) -> Optional[T]:
        where, values = self._key_where(key)
        sql = f"SELECT * FROM {self._table} WHERE {where}"
        try:
            with self._pool.connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(sql, values)
                    row = cur.fetchone()
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"bridge get_or_none({self._table}) failed: {exc}"
            ) from exc
        if row is None:
            return None
        return row_to_entity(self.entity_type, dict(row))

    def list(self, **filters: Any) -> list[T]:
        validate_filter_fields(self.entity_type, filters)
        where_parts: list[str] = []
        values: list[Any] = []
        for col, val in filters.items():
            if val is None:
                where_parts.append(f"{col} IS NULL")
            else:
                where_parts.append(f"{col} = %s")
                values.append(serialize_value(val))
        where_clause = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""
        sql = f"SELECT * FROM {self._table}{where_clause}"
        try:
            with self._pool.connection() as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    cur.execute(sql, values or None)
                    rows = cur.fetchall()
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"bridge list({self._table}) failed: {exc}"
            ) from exc
        return [row_to_entity(self.entity_type, dict(r)) for r in rows]

    def delete(self, *key: Any) -> None:
        where, values = self._key_where(key)
        sql = f"DELETE FROM {self._table} WHERE {where}"
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, values)
                    if cur.rowcount == 0:
                        raise EntityNotFound(
                            f"{self.entity_type.__name__} link {tuple(key)} not found"
                        )
        except EntityNotFound:
            raise
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"bridge delete({self._table}) failed: {exc}"
            ) from exc

    def count(self, **filters: Any) -> int:
        validate_filter_fields(self.entity_type, filters)
        where_parts: list[str] = []
        values: list[Any] = []
        for col, val in filters.items():
            if val is None:
                where_parts.append(f"{col} IS NULL")
            else:
                where_parts.append(f"{col} = %s")
                values.append(serialize_value(val))
        where_clause = f" WHERE {' AND '.join(where_parts)}" if where_parts else ""
        sql = f"SELECT COUNT(*) FROM {self._table}{where_clause}"
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, values or None)
                    result = cur.fetchone()
                    return int(result[0])
        except psycopg2.Error as exc:
            raise PersistenceError(
                f"bridge count({self._table}) failed: {exc}"
            ) from exc

    # -- transaction support (no-ops) --------------------------------------- #

    def _snapshot(self) -> None:
        return None

    def _restore(self, snapshot: None) -> None:
        pass


__all__ = ["PostgresRepository", "PostgresBridgeRepository"]
