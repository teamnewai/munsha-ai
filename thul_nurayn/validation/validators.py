"""THUL-NURAYN v1 — Validation Layer.

A small, dependency-free validation toolkit plus entity-level validators for
the core domain models. The design goal is *fail-safe* validation: collect all
field errors and raise a single :class:`ValidationError` so nothing is
silently accepted.

This layer validates **shape and invariants only** — it deliberately contains
no trading, scoring, or risk *logic* (out of scope for D1).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from numbers import Number
from typing import Any, Callable, Optional

from thul_nurayn.domain.enums import _StrEnum
from thul_nurayn.validation.errors import FieldError, ValidationError

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SYMBOL_RE = re.compile(r"^[A-Z0-9.\-]{1,32}$")


class Validator:
    """Accumulates field errors, then raises once via :meth:`raise_if_errors`."""

    def __init__(self) -> None:
        self._errors: list[FieldError] = []

    # -- primitives -------------------------------------------------------- #
    def add(self, field: str, message: str) -> "Validator":
        self._errors.append(FieldError(field, message))
        return self

    def require(self, field: str, value: Any) -> "Validator":
        if value is None or (isinstance(value, str) and value.strip() == ""):
            self.add(field, "is required")
        return self

    def max_len(self, field: str, value: Optional[str], n: int) -> "Validator":
        if value is not None and len(value) > n:
            self.add(field, f"must be at most {n} characters")
        return self

    def email(self, field: str, value: Optional[str]) -> "Validator":
        if value is not None and not _EMAIL_RE.match(value):
            self.add(field, "is not a valid email address")
        return self

    def symbol(self, field: str, value: Optional[str]) -> "Validator":
        if value is not None and not _SYMBOL_RE.match(value):
            self.add(field, "is not a valid instrument symbol")
        return self

    def positive(self, field: str, value: Any) -> "Validator":
        if value is not None and _as_decimal(self, field, value) is not None:
            if Decimal(str(value)) <= 0:
                self.add(field, "must be greater than zero")
        return self

    def non_negative(self, field: str, value: Any) -> "Validator":
        if value is not None and _as_decimal(self, field, value) is not None:
            if Decimal(str(value)) < 0:
                self.add(field, "must be zero or greater")
        return self

    def in_range(
        self, field: str, value: Any, lo: float, hi: float
    ) -> "Validator":
        if value is not None and isinstance(value, Number):
            if not (lo <= float(value) <= hi):
                self.add(field, f"must be between {lo} and {hi}")
        return self

    def enum(self, field: str, value: Any, enum_cls: type[_StrEnum]) -> "Validator":
        if value is not None:
            try:
                enum_cls.coerce(value)
            except ValueError:
                self.add(
                    field,
                    f"must be one of {enum_cls.values()}",
                )
        return self

    def custom(
        self, field: str, value: Any, predicate: Callable[[Any], bool], message: str
    ) -> "Validator":
        if value is not None and not predicate(value):
            self.add(field, message)
        return self

    # -- terminal ---------------------------------------------------------- #
    @property
    def errors(self) -> list[FieldError]:
        return list(self._errors)

    @property
    def ok(self) -> bool:
        return not self._errors

    def raise_if_errors(self) -> None:
        if self._errors:
            raise ValidationError(self._errors)


def _as_decimal(v: Validator, field: str, value: Any) -> Optional[Decimal]:
    try:
        Decimal(str(value))
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        v.add(field, "must be numeric")
        return None


# --------------------------------------------------------------------------- #
# Entity validators (shape + invariants only)
# --------------------------------------------------------------------------- #
def validate_user(data: dict[str, Any]) -> None:
    from thul_nurayn.domain.enums import UserRole

    v = Validator()
    v.require("email", data.get("email")).email("email", data.get("email"))
    v.max_len("full_name", data.get("full_name"), 256)
    if data.get("role") is not None:
        v.enum("role", data.get("role"), UserRole)
    v.raise_if_errors()


def validate_instrument(data: dict[str, Any]) -> None:
    v = Validator()
    v.require("symbol", data.get("symbol")).symbol("symbol", data.get("symbol"))
    v.require("name", data.get("name")).max_len("name", data.get("name"), 256)
    if data.get("tick_size") is not None:
        v.positive("tick_size", data.get("tick_size"))
    if data.get("lot_size") is not None:
        v.positive("lot_size", data.get("lot_size"))
    v.raise_if_errors()


def validate_signal(data: dict[str, Any]) -> None:
    from thul_nurayn.domain.enums import Direction, EngineType, MarketRegime

    v = Validator()
    v.require("instrument_id", data.get("instrument_id"))
    v.require("engine_type", data.get("engine_type"))
    v.enum("engine_type", data.get("engine_type"), EngineType)
    v.require("direction", data.get("direction"))
    v.enum("direction", data.get("direction"), Direction)
    if data.get("regime") is not None:
        v.enum("regime", data.get("regime"), MarketRegime)
    v.raise_if_errors()


def validate_order(data: dict[str, Any]) -> None:
    from thul_nurayn.domain.enums import Direction, OrderStatus

    v = Validator()
    v.require("instrument_id", data.get("instrument_id"))
    v.require("direction", data.get("direction"))
    v.enum("direction", data.get("direction"), Direction)
    v.require("quantity", data.get("quantity")).positive(
        "quantity", data.get("quantity")
    )
    if data.get("status") is not None:
        v.enum("status", data.get("status"), OrderStatus)
    if data.get("limit_price") is not None:
        v.positive("limit_price", data.get("limit_price"))
    v.raise_if_errors()


def validate_fill(data: dict[str, Any]) -> None:
    v = Validator()
    v.require("order_id", data.get("order_id"))
    v.require("fill_quantity", data.get("fill_quantity")).positive(
        "fill_quantity", data.get("fill_quantity")
    )
    v.require("fill_price", data.get("fill_price")).positive(
        "fill_price", data.get("fill_price")
    )
    if data.get("commission") is not None:
        v.non_negative("commission", data.get("commission"))
    v.raise_if_errors()


def validate_market_snapshot(data: dict[str, Any]) -> None:
    v = Validator()
    v.require("instrument_id", data.get("instrument_id"))
    v.require("snapshot_time", data.get("snapshot_time"))
    for fld in ("open", "high", "low", "close"):
        v.require(fld, data.get(fld)).positive(fld, data.get(fld))
    if data.get("volume") is not None:
        v.non_negative("volume", data.get("volume"))
    # ohlc coherence
    o, h, low_, c = (data.get(k) for k in ("open", "high", "low", "close"))
    if all(isinstance(x, Number) for x in (o, h, low_, c)):
        if not (h >= max(o, c, low_) and low_ <= min(o, c, h)):
            v.add("high/low", "OHLC values are inconsistent")
    v.raise_if_errors()


ENTITY_VALIDATORS: dict[str, Callable[[dict[str, Any]], None]] = {
    "user": validate_user,
    "instrument": validate_instrument,
    "signal": validate_signal,
    "order": validate_order,
    "fill": validate_fill,
    "market_snapshot": validate_market_snapshot,
}

__all__ = [
    "Validator",
    "ValidationError",
    "FieldError",
    "validate_user",
    "validate_instrument",
    "validate_signal",
    "validate_order",
    "validate_fill",
    "validate_market_snapshot",
    "ENTITY_VALIDATORS",
]
