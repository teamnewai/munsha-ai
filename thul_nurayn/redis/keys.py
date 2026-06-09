"""THUL-NURAYN v1 — Redis key schema.

Every Redis key lives under a single configurable namespace (default ``tn``)
and a layer prefix, so the non-persistent operational layer never collides
with anything else and is trivially inspectable / flushable per-layer.

Layers (per the D1 brief):
    cache    →  tn:cache:*     transient read-through cache
    events   →  tn:events:*    event queues / streams
    queue    →  tn:queue:*     worker job queues (+ :processing)
    dlq      →  tn:dlq:*       dead-letter queue
    health   →  tn:health:*    component heartbeats / health keys
    state    →  tn:state:*     temporary state storage
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class KeyBuilder:
    namespace: str = "tn"

    def _k(self, *parts: str) -> str:
        return ":".join((self.namespace, *parts))

    # -- cache ------------------------------------------------------------- #
    def cache(self, *parts: str) -> str:
        return self._k("cache", *parts)

    # -- event queues / streams ------------------------------------------- #
    def event_stream(self, name: str) -> str:
        return self._k("events", name)

    # -- worker queues ----------------------------------------------------- #
    def queue(self, name: str) -> str:
        return self._k("queue", name)

    def queue_processing(self, name: str) -> str:
        return self._k("queue", name, "processing")

    # -- dead letter queue ------------------------------------------------- #
    def dlq(self, name: str) -> str:
        return self._k("dlq", name)

    # -- health ------------------------------------------------------------ #
    def health(self, component: str) -> str:
        return self._k("health", component)

    @property
    def health_pattern(self) -> str:
        return self._k("health", "*")

    # -- temporary state --------------------------------------------------- #
    def state(self, *parts: str) -> str:
        return self._k("state", *parts)


__all__ = ["KeyBuilder"]
