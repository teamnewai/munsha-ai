"""THUL-NURAYN v1 — D6 Portfolio error hierarchy."""

from __future__ import annotations


class PortfolioError(Exception):
    """Base for all portfolio errors."""


class InvalidCapital(PortfolioError):
    """Starting capital must be > 0 (fail-safe §13)."""


class PositionStateError(PortfolioError):
    """Registry or state-reflection error (e.g. position not found)."""


__all__ = ["PortfolioError", "InvalidCapital", "PositionStateError"]
