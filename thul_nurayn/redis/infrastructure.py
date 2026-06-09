"""THUL-NURAYN v1 — Redis Infrastructure.

Provides the six operational components the D1 brief requires:

    * Cache Layer            (:class:`Cache`)
    * Event Queues           (:class:`EventQueue`)
    * Worker Queues          (:class:`WorkQueue`)
    * Dead Letter Queue      (:class:`DeadLetterQueue`)
    * Health Keys            (:class:`HealthRegistry`)
    * Temporary State Store  (:class:`StateStore`)

Architectural invariant: **Redis is non-persistent / operational only.** It
is never the source of truth (that is PostgreSQL). Everything here is safe to
lose; durable state must be persisted to Postgres by the relevant engine.

The components are written against a tiny backend protocol
(:class:`RedisBackend`). A real deployment uses :class:`RedisPyBackend`
(redis-py); unit tests use :class:`InMemoryBackend` so no server is required.
The brief's D1 scope is the *infrastructure*, not the engines that fill it.
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, Optional, Protocol

from thul_nurayn.redis.keys import KeyBuilder


# --------------------------------------------------------------------------- #
# Backend protocol + implementations
# --------------------------------------------------------------------------- #
class RedisBackend(Protocol):
    def set(self, key: str, value: str, ex: Optional[int] = None) -> None: ...
    def get(self, key: str) -> Optional[str]: ...
    def delete(self, key: str) -> int: ...
    def exists(self, key: str) -> bool: ...
    def lpush(self, key: str, value: str) -> int: ...
    def rpoplpush(self, src: str, dst: str) -> Optional[str]: ...
    def lrem(self, key: str, count: int, value: str) -> int: ...
    def lrange(self, key: str, start: int, stop: int) -> list[str]: ...
    def llen(self, key: str) -> int: ...
    def keys(self, pattern: str) -> list[str]: ...


class InMemoryBackend:
    """A dependency-free, single-process backend for tests/local use.

    Implements only the subset of Redis commands this module needs. TTLs are
    tracked but only lazily expired on access (sufficient for tests).
    """

    def __init__(self) -> None:
        self._kv: dict[str, str] = {}
        self._expiry: dict[str, float] = {}
        self._lists: dict[str, list[str]] = {}

    def _expired(self, key: str) -> bool:
        exp = self._expiry.get(key)
        if exp is not None and time.time() >= exp:
            self._kv.pop(key, None)
            self._expiry.pop(key, None)
            self._lists.pop(key, None)
            return True
        return False

    def set(self, key: str, value: str, ex: Optional[int] = None) -> None:
        self._kv[key] = value
        if ex is not None:
            self._expiry[key] = time.time() + ex
        else:
            self._expiry.pop(key, None)

    def get(self, key: str) -> Optional[str]:
        if self._expired(key):
            return None
        return self._kv.get(key)

    def delete(self, key: str) -> int:
        found = int(key in self._kv or key in self._lists)
        self._kv.pop(key, None)
        self._lists.pop(key, None)
        self._expiry.pop(key, None)
        return found

    def exists(self, key: str) -> bool:
        if self._expired(key):
            return False
        return key in self._kv or key in self._lists

    def lpush(self, key: str, value: str) -> int:
        self._lists.setdefault(key, []).insert(0, value)
        return len(self._lists[key])

    def rpoplpush(self, src: str, dst: str) -> Optional[str]:
        lst = self._lists.get(src)
        if not lst:
            return None
        value = lst.pop()  # right
        self._lists.setdefault(dst, []).insert(0, value)
        return value

    def lrem(self, key: str, count: int, value: str) -> int:
        lst = self._lists.get(key, [])
        removed = 0
        kept: list[str] = []
        for item in lst:
            if item == value and (count == 0 or removed < abs(count)):
                removed += 1
            else:
                kept.append(item)
        self._lists[key] = kept
        return removed

    def lrange(self, key: str, start: int, stop: int) -> list[str]:
        lst = self._lists.get(key, [])
        if stop == -1:
            return lst[start:]
        return lst[start : stop + 1]

    def llen(self, key: str) -> int:
        return len(self._lists.get(key, []))

    def keys(self, pattern: str) -> list[str]:
        # Only supports trailing '*' glob (sufficient for health_pattern).
        prefix = pattern[:-1] if pattern.endswith("*") else pattern
        out = [k for k in {**self._kv, **self._lists} if k.startswith(prefix)]
        return [k for k in out if not self._expired(k)]


class RedisPyBackend:
    """Adapter over a redis-py ``Redis`` client (decode_responses=True)."""

    def __init__(self, client: Any) -> None:
        self._c = client

    def set(self, key: str, value: str, ex: Optional[int] = None) -> None:
        self._c.set(key, value, ex=ex)

    def get(self, key: str) -> Optional[str]:
        return self._c.get(key)

    def delete(self, key: str) -> int:
        return int(self._c.delete(key))

    def exists(self, key: str) -> bool:
        return bool(self._c.exists(key))

    def lpush(self, key: str, value: str) -> int:
        return int(self._c.lpush(key, value))

    def rpoplpush(self, src: str, dst: str) -> Optional[str]:
        return self._c.rpoplpush(src, dst)

    def lrem(self, key: str, count: int, value: str) -> int:
        return int(self._c.lrem(key, count, value))

    def lrange(self, key: str, start: int, stop: int) -> list[str]:
        return list(self._c.lrange(key, start, stop))

    def llen(self, key: str) -> int:
        return int(self._c.llen(key))

    def keys(self, pattern: str) -> list[str]:
        return list(self._c.keys(pattern))


def build_redis_backend(url: str, socket_timeout: int = 5) -> RedisBackend:
    """Create a :class:`RedisPyBackend` from a URL (redis-py required)."""
    try:
        import redis  # type: ignore
    except ImportError as exc:  # pragma: no cover - environment dependent
        raise RuntimeError(
            "redis-py is not installed; add 'redis' to requirements to use a "
            "live backend, or use InMemoryBackend for tests."
        ) from exc
    client = redis.from_url(
        url, decode_responses=True, socket_timeout=socket_timeout
    )
    return RedisPyBackend(client)


# --------------------------------------------------------------------------- #
# Components
# --------------------------------------------------------------------------- #
def _dumps(payload: Any) -> str:
    return json.dumps(payload, default=str, separators=(",", ":"))


def _loads(raw: Optional[str]) -> Optional[Any]:
    return None if raw is None else json.loads(raw)


class Cache:
    def __init__(self, backend: RedisBackend, keys: KeyBuilder):
        self._b, self._k = backend, keys

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        self._b.set(self._k.cache(key), _dumps(value), ex=ttl)

    def get(self, key: str) -> Optional[Any]:
        return _loads(self._b.get(self._k.cache(key)))

    def delete(self, key: str) -> bool:
        return self._b.delete(self._k.cache(key)) > 0


class StateStore:
    """Temporary, TTL'd operational state (never durable)."""

    def __init__(self, backend: RedisBackend, keys: KeyBuilder):
        self._b, self._k = backend, keys

    def set(self, *parts: str, value: Any, ttl: Optional[int] = None) -> None:
        self._b.set(self._k.state(*parts), _dumps(value), ex=ttl)

    def get(self, *parts: str) -> Optional[Any]:
        return _loads(self._b.get(self._k.state(*parts)))

    def delete(self, *parts: str) -> bool:
        return self._b.delete(self._k.state(*parts)) > 0


class EventQueue:
    """Fan-in event queue (LPUSH + range read). Append-only, fire-and-forget."""

    def __init__(self, backend: RedisBackend, keys: KeyBuilder):
        self._b, self._k = backend, keys

    def publish(self, stream: str, event: dict[str, Any]) -> None:
        envelope = {"id": str(uuid.uuid4()), "ts": time.time(), "event": event}
        self._b.lpush(self._k.event_stream(stream), _dumps(envelope))

    def recent(self, stream: str, limit: int = 100) -> list[dict[str, Any]]:
        raw = self._b.lrange(self._k.event_stream(stream), 0, limit - 1)
        return [json.loads(r) for r in raw]

    def depth(self, stream: str) -> int:
        return self._b.llen(self._k.event_stream(stream))


class DeadLetterQueue:
    def __init__(self, backend: RedisBackend, keys: KeyBuilder):
        self._b, self._k = backend, keys

    def push(self, queue_name: str, payload: Any, reason: str) -> None:
        record = {
            "id": str(uuid.uuid4()),
            "ts": time.time(),
            "reason": reason,
            "payload": payload,
        }
        self._b.lpush(self._k.dlq(queue_name), _dumps(record))

    def list(self, queue_name: str, limit: int = 100) -> list[dict[str, Any]]:
        raw = self._b.lrange(self._k.dlq(queue_name), 0, limit - 1)
        return [json.loads(r) for r in raw]

    def size(self, queue_name: str) -> int:
        return self._b.llen(self._k.dlq(queue_name))


class WorkQueue:
    """Reliable worker queue with an in-flight 'processing' list and DLQ.

    Pattern: ``enqueue`` LPUSHes a job; ``reserve`` atomically moves a job to a
    per-queue processing list (RPOPLPUSH); ``ack`` removes it; ``fail`` removes
    it from processing and routes it to the DLQ. This mirrors the standard
    reliable-queue pattern so a crashed worker's job remains recoverable.
    """

    def __init__(self, backend: RedisBackend, keys: KeyBuilder, dlq: DeadLetterQueue):
        self._b, self._k, self._dlq = backend, keys, dlq

    def enqueue(self, queue_name: str, job: dict[str, Any]) -> str:
        job_id = str(job.get("id") or uuid.uuid4())
        envelope = {"id": job_id, "ts": time.time(), "job": job}
        self._b.lpush(self._k.queue(queue_name), _dumps(envelope))
        return job_id

    def reserve(self, queue_name: str) -> Optional[dict[str, Any]]:
        raw = self._b.rpoplpush(
            self._k.queue(queue_name), self._k.queue_processing(queue_name)
        )
        return None if raw is None else json.loads(raw)

    def ack(self, queue_name: str, envelope: dict[str, Any]) -> bool:
        removed = self._b.lrem(
            self._k.queue_processing(queue_name), 1, _dumps(envelope)
        )
        return removed > 0

    def fail(self, queue_name: str, envelope: dict[str, Any], reason: str) -> None:
        self._b.lrem(self._k.queue_processing(queue_name), 1, _dumps(envelope))
        self._dlq.push(queue_name, envelope, reason)

    def depth(self, queue_name: str) -> int:
        return self._b.llen(self._k.queue(queue_name))

    def in_flight(self, queue_name: str) -> int:
        return self._b.llen(self._k.queue_processing(queue_name))


class HealthRegistry:
    def __init__(self, backend: RedisBackend, keys: KeyBuilder):
        self._b, self._k = backend, keys

    def heartbeat(self, component: str, ttl: int = 30, **meta: Any) -> None:
        payload = {"ts": time.time(), "status": "up", **meta}
        self._b.set(self._k.health(component), _dumps(payload), ex=ttl)

    def status(self, component: str) -> Optional[dict[str, Any]]:
        return _loads(self._b.get(self._k.health(component)))

    def is_healthy(self, component: str) -> bool:
        return self._b.exists(self._k.health(component))

    def all(self) -> dict[str, dict[str, Any]]:
        prefix = self._k.health("")
        out: dict[str, dict[str, Any]] = {}
        for key in self._b.keys(self._k.health_pattern):
            name = key[len(prefix):]
            val = _loads(self._b.get(key))
            if val is not None:
                out[name] = val
        return out


class RedisInfrastructure:
    """Facade wiring all six operational components onto one backend."""

    def __init__(self, backend: RedisBackend, namespace: str = "tn"):
        self.backend = backend
        self.keys = KeyBuilder(namespace=namespace)
        self.cache = Cache(backend, self.keys)
        self.state = StateStore(backend, self.keys)
        self.events = EventQueue(backend, self.keys)
        self.dlq = DeadLetterQueue(backend, self.keys)
        self.queues = WorkQueue(backend, self.keys, self.dlq)
        self.health = HealthRegistry(backend, self.keys)

    @classmethod
    def in_memory(cls, namespace: str = "tn") -> "RedisInfrastructure":
        return cls(InMemoryBackend(), namespace=namespace)


__all__ = [
    "RedisBackend",
    "InMemoryBackend",
    "RedisPyBackend",
    "build_redis_backend",
    "Cache",
    "StateStore",
    "EventQueue",
    "DeadLetterQueue",
    "WorkQueue",
    "HealthRegistry",
    "RedisInfrastructure",
]
