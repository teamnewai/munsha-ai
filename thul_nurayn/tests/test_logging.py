"""Tests for the logging layer."""

import io
import json

from thul_nurayn.logging import configure_logging, get_logger


def _capture(json_output=True):
    stream = io.StringIO()
    configure_logging(level="DEBUG", json_output=json_output, stream=stream)
    return stream


def test_json_log_shape():
    stream = _capture()
    log = get_logger("test.logger")
    log.info("hello", instrument="AAPL", qty=10)
    line = stream.getvalue().strip().splitlines()[-1]
    record = json.loads(line)
    assert record["level"] == "INFO"
    assert record["message"] == "hello"
    assert record["logger"] == "test.logger"
    assert record["instrument"] == "AAPL"
    assert record["qty"] == 10
    assert record["service"] == "thul-nurayn"
    assert "ts" in record


def test_bound_context_propagates():
    stream = _capture()
    log = get_logger("ctx").bind(request_id="r-1")
    log.warning("careful")
    record = json.loads(stream.getvalue().strip().splitlines()[-1])
    assert record["request_id"] == "r-1"
    assert record["level"] == "WARNING"


def test_severity_levels_map():
    stream = _capture()
    log = get_logger("sev")
    log.debug("d")
    log.error("e")
    levels = [json.loads(l)["level"] for l in stream.getvalue().strip().splitlines()]
    assert "DEBUG" in levels
    assert "ERROR" in levels


def test_idempotent_configure_no_duplicate_handlers():
    stream = _capture()
    _capture()  # reconfigure
    stream2 = _capture()
    log = get_logger("once")
    log.info("single")
    # Only the latest stream should receive exactly one line.
    assert len(stream2.getvalue().strip().splitlines()) == 1


def test_non_serializable_extra_is_stringified():
    stream = _capture()
    log = get_logger("obj")

    class Weird:
        def __repr__(self):
            return "<weird>"

    log.info("msg", thing=Weird())
    record = json.loads(stream.getvalue().strip().splitlines()[-1])
    assert record["thing"] == "<weird>"
