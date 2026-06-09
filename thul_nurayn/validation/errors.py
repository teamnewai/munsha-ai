"""Validation error types for THUL-NURAYN v1."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class FieldError:
    field: str
    message: str

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.field}: {self.message}"


class ValidationError(ValueError):
    """Raised when one or more fields fail validation.

    Carries the structured list of field-level errors so callers (and the
    logging layer) can render or persist them precisely.
    """

    def __init__(self, errors: list[FieldError]):
        self.errors = errors
        super().__init__("; ".join(str(e) for e in errors))


__all__ = ["FieldError", "ValidationError"]
