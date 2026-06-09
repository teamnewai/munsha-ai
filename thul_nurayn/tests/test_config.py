"""Tests for the configuration layer."""

from thul_nurayn.config import Settings, load_settings


def test_defaults_when_no_env(monkeypatch, tmp_path):
    # Ensure no TN_* env leaks in.
    for key in list(__import__("os").environ):
        if key.startswith("TN_"):
            monkeypatch.delenv(key, raising=False)
    s = load_settings(dotenv_path=tmp_path / "missing.env")
    assert isinstance(s, Settings)
    assert s.app.environment == "development"
    assert s.database.port == 5432
    assert s.redis.namespace == "tn"
    assert s.logging.json is True
    assert not s.is_production


def test_env_overrides(monkeypatch, tmp_path):
    monkeypatch.setenv("TN_ENV", "production")
    monkeypatch.setenv("TN_DB_PORT", "6000")
    monkeypatch.setenv("TN_DEBUG", "true")
    monkeypatch.setenv("TN_LOG_JSON", "false")
    s = load_settings(dotenv_path=tmp_path / "missing.env")
    assert s.is_production
    assert s.database.port == 6000
    assert s.app.debug is True
    assert s.logging.json is False


def test_dotenv_overlay(monkeypatch, tmp_path):
    for key in list(__import__("os").environ):
        if key.startswith("TN_"):
            monkeypatch.delenv(key, raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        '# comment\nTN_REDIS_HOST="redis.internal"\nTN_DB_NAME=tn_prod\n'
    )
    s = load_settings(dotenv_path=env_file)
    assert s.redis.host == "redis.internal"
    assert s.database.name == "tn_prod"


def test_dsn_and_redis_url(monkeypatch, tmp_path):
    monkeypatch.setenv("TN_DB_PASSWORD", "secret")
    monkeypatch.setenv("TN_REDIS_PASSWORD", "rpw")
    s = load_settings(dotenv_path=tmp_path / "missing.env")
    assert "secret" in s.database.dsn
    assert s.database.dsn.startswith("postgresql://")
    assert s.redis.url.startswith("redis://:rpw@")


def test_invalid_int_falls_back(monkeypatch, tmp_path):
    monkeypatch.setenv("TN_DB_PORT", "not-a-number")
    s = load_settings(dotenv_path=tmp_path / "missing.env")
    assert s.database.port == 5432
