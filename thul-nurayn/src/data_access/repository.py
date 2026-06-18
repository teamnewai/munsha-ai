"""THUL-NURAYN v1 — D2 repository contracts and in-memory implementation.

Components (D2_DATA_ACCESS_REPORT §2):
  * Repository (ABC)        — abstract store interface.
  * InMemoryRepository      — in-memory store; swappable for PostgresRepository (B7).
  * BridgeRepository        — composite-key store for the 2 bridge tables.

Storage and retrieval ONLY — no trading/strategy/risk/execution logic.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Generic, Iterable, Optional, TypeVar

from .errors import DuplicateEntity, EntityNotFound, ImmutableViolation
from .validation import validate_entity_type, validate_filter_fields

T = TypeVar("T")


class Repository(ABC, Generic[T]):
    """Abstract single-entity store.

    Seven operations per D2_DATA_ACCESS_REPORT §2/§6:
    add · get · get_or_none · list · update · delete · count.
    """

    @abstractmethod
    def add(self, entity: T) -> T: ...

    @abstractmethod
    def get(self, entity_id: Any) -> T: ...

    @abstractmethod
    def get_or_none(self, entity_id: Any) -> Optional[T]: ...

    @abstractmethod
    def list(self, **filters: Any) -> list[T]: ...

    @abstractmethod
    def update(self, entity: T) -> T: ...

    @abstractmethod
    def delete(self, entity_id: Any) -> None: ...

    @abstractmethod
    def count(self, **filters: Any) -> int: ...


class InMemoryRepository(Repository[T]):
    """Dict-backed repository for a single entity type.

    Guarantees (data layer only):
      * Duplicate protection on the id key and on declared unique fields.
      * Filter validation against the entity's dataclass fields.
      * Optional append-only mode (update/delete raise ImmutableViolation).
    """

    def __init__(
        self,
        entity_type: type,
        *,
        id_attr: str = "id",
        unique_fields: Iterable[str] = (),
        append_only: bool = False,
    ) -> None:
        self.entity_type = entity_type
        self._id_attr = id_attr
        self._unique_fields = tuple(unique_fields)
        self.append_only = append_only
        self._store: dict[Any, T] = {}

    # -- helpers ----------------------------------------------------------- #
    def _key(self, entity: T) -> Any:
        return getattr(entity, self._id_attr)

    def _matches(self, entity: T, filters: dict[str, Any]) -> bool:
        return all(getattr(entity, k) == v for k, v in filters.items())

    def _check_unique(self, entity: T, exclude_key: Any = None) -> None:
        for fld in self._unique_fields:
            value = getattr(entity, fld)
            for key, existing in self._store.items():
                if key == exclude_key:
                    continue
                if getattr(existing, fld) == value:
                    raise DuplicateEntity(
                        f"{self.entity_type.__name__} with {fld}={value!r} already exists"
                    )

    # -- CRUD -------------------------------------------------------------- #
    def add(self, entity: T) -> T:
        validate_entity_type(entity, self.entity_type)
        key = self._key(entity)
        if key in self._store:
            raise DuplicateEntity(
                f"{self.entity_type.__name__} with id={key} already exists"
            )
        self._check_unique(entity)
        self._store[key] = entity
        return entity

    def get(self, entity_id: Any) -> T:
        try:
            return self._store[entity_id]
        except KeyError:
            raise EntityNotFound(
                f"{self.entity_type.__name__} id={entity_id} not found"
            ) from None

    def get_or_none(self, entity_id: Any) -> Optional[T]:
        return self._store.get(entity_id)

    def list(self, **filters: Any) -> list[T]:
        validate_filter_fields(self.entity_type, filters)
        return [e for e in self._store.values() if self._matches(e, filters)]

    def update(self, entity: T) -> T:
        if self.append_only:
            raise ImmutableViolation(
                f"{self.entity_type.__name__} is append-only; update not permitted"
            )
        validate_entity_type(entity, self.entity_type)
        key = self._key(entity)
        if key not in self._store:
            raise EntityNotFound(
                f"{self.entity_type.__name__} id={key} not found"
            )
        self._check_unique(entity, exclude_key=key)
        self._store[key] = entity
        return entity

    def delete(self, entity_id: Any) -> None:
        if self.append_only:
            raise ImmutableViolation(
                f"{self.entity_type.__name__} is append-only; delete not permitted"
            )
        if entity_id not in self._store:
            raise EntityNotFound(
                f"{self.entity_type.__name__} id={entity_id} not found"
            )
        del self._store[entity_id]

    def count(self, **filters: Any) -> int:
        return len(self.list(**filters))

    # -- transaction support (used by DataAccessLayer) --------------------- #
    def _snapshot(self) -> dict[Any, T]:
        return dict(self._store)

    def _restore(self, snapshot: dict[Any, T]) -> None:
        self._store.clear()
        self._store.update(snapshot)


class BridgeRepository(Generic[T]):
    """Composite-key store for bridge (many-to-many) tables.

    Supports add · get_or_none · list · delete · count over a two-field
    composite key. No update (bridge rows are link records).
    """

    def __init__(self, entity_type: type, key_fields: tuple[str, str]) -> None:
        self.entity_type = entity_type
        self._key_fields = key_fields
        self._store: dict[tuple, T] = {}

    def _key(self, entity: T) -> tuple:
        return tuple(getattr(entity, f) for f in self._key_fields)

    def add(self, entity: T) -> T:
        validate_entity_type(entity, self.entity_type)
        key = self._key(entity)
        if key in self._store:
            raise DuplicateEntity(
                f"{self.entity_type.__name__} link {key} already exists"
            )
        self._store[key] = entity
        return entity

    def get_or_none(self, *key: Any) -> Optional[T]:
        return self._store.get(tuple(key))

    def list(self, **filters: Any) -> list[T]:
        validate_filter_fields(self.entity_type, filters)
        return [
            e for e in self._store.values()
            if all(getattr(e, k) == v for k, v in filters.items())
        ]

    def delete(self, *key: Any) -> None:
        if tuple(key) not in self._store:
            raise EntityNotFound(
                f"{self.entity_type.__name__} link {tuple(key)} not found"
            )
        del self._store[tuple(key)]

    def count(self, **filters: Any) -> int:
        return len(self.list(**filters))

    def _snapshot(self) -> dict[tuple, T]:
        return dict(self._store)

    def _restore(self, snapshot: dict[tuple, T]) -> None:
        self._store.clear()
        self._store.update(snapshot)


__all__ = ["Repository", "InMemoryRepository", "BridgeRepository"]
