"""Tests for the Redis operational layer (key schema + components).

Uses the dependency-free InMemoryBackend so no Redis server is required.
"""

import pytest

from thul_nurayn.redis import KeyBuilder, RedisInfrastructure


@pytest.fixture()
def infra():
    return RedisInfrastructure.in_memory(namespace="tn")


def test_key_namespacing():
    k = KeyBuilder("tn")
    assert k.cache("instrument", "AAPL") == "tn:cache:instrument:AAPL"
    assert k.queue("scan") == "tn:queue:scan"
    assert k.queue_processing("scan") == "tn:queue:scan:processing"
    assert k.dlq("scan") == "tn:dlq:scan"
    assert k.event_stream("signals") == "tn:events:signals"
    assert k.health("scanner") == "tn:health:scanner"
    assert k.state("session", "abc") == "tn:state:session:abc"
    assert k.health_pattern == "tn:health:*"


def test_cache_set_get_delete(infra):
    infra.cache.set("k", {"a": 1})
    assert infra.cache.get("k") == {"a": 1}
    assert infra.cache.delete("k")
    assert infra.cache.get("k") is None


def test_state_store(infra):
    infra.state.set("session", "x", value={"step": 2})
    assert infra.state.get("session", "x") == {"step": 2}
    assert infra.state.delete("session", "x")
    assert infra.state.get("session", "x") is None


def test_event_queue_publish_and_read(infra):
    infra.events.publish("signals", {"id": 1})
    infra.events.publish("signals", {"id": 2})
    assert infra.events.depth("signals") == 2
    recent = infra.events.recent("signals", limit=10)
    assert recent[0]["event"] == {"id": 2}  # LPUSH → newest first


def test_work_queue_reliable_lifecycle(infra):
    q = "scan"
    infra.queues.enqueue(q, {"symbol": "AAPL"})
    assert infra.queues.depth(q) == 1

    env = infra.queues.reserve(q)
    assert env is not None
    assert infra.queues.depth(q) == 0
    assert infra.queues.in_flight(q) == 1

    assert infra.queues.ack(q, env) is True
    assert infra.queues.in_flight(q) == 0


def test_work_queue_failure_routes_to_dlq(infra):
    q = "scan"
    infra.queues.enqueue(q, {"symbol": "BAD"})
    env = infra.queues.reserve(q)
    infra.queues.fail(q, env, reason="boom")
    assert infra.queues.in_flight(q) == 0
    assert infra.dlq.size(q) == 1
    dead = infra.dlq.list(q)
    assert dead[0]["reason"] == "boom"
    assert dead[0]["payload"] == env


def test_reserve_empty_returns_none(infra):
    assert infra.queues.reserve("empty") is None


def test_health_registry(infra):
    infra.health.heartbeat("scanner", ttl=30, version="1.0.0")
    assert infra.health.is_healthy("scanner")
    status = infra.health.status("scanner")
    assert status["status"] == "up"
    assert status["version"] == "1.0.0"
    allh = infra.health.all()
    assert "scanner" in allh


def test_health_ttl_expiry():
    infra = RedisInfrastructure.in_memory()
    # ttl=0 → immediately expired on next access
    infra.health.heartbeat("x", ttl=0)
    assert not infra.health.is_healthy("x")
