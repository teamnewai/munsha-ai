"""THUL-NURAYN v1 — B7 persistence package.

Provides:
  ConnectionPool             — psycopg2 ThreadedConnectionPool; env-based config.
  PostgresRepository[T]      — concrete Repository[T] ABC for PostgreSQL.
  PostgresBridgeRepository   — composite-key persistence for bridge tables.
  PostgresDataAccessLayer    — DataAccessLayer subclass wired to PostgreSQL.
  PersistenceError           — base infrastructure error.
"""

from .connection import ConnectionPool
from .dal import PostgresDataAccessLayer
from .errors import PersistenceError
from .repository import PostgresBridgeRepository, PostgresRepository

__all__ = [
    "ConnectionPool",
    "PostgresRepository",
    "PostgresBridgeRepository",
    "PostgresDataAccessLayer",
    "PersistenceError",
]
