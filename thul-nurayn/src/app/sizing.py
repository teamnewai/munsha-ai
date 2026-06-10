"""THUL-NURAYN v1 — P-SIZE position sizing (implements the approved fixed policy).

Implements (does NOT modify) the already-approved fixed owner capital-allocation
policy (P-SIZE_ARCHITECTURE.md). A pure, deterministic, stateless sizing step
invoked by P-ORCH between Risk and Execution.

Quantity is derived SOLELY from (requirement 13):
  * Capital Policy      — owner-defined base capital (NON-compounding)
  * Allocation Policy   — owner-defined per-trade allocation fraction
  * Instrument Price    — the supplied mark

    quantity = floor( allocation_fraction × capital ÷ mark )   [whole shares]

Explicitly NONE of: risk-based / Kelly / volatility / ATR / dynamic / compounding
/ auto-growth sizing. The function reads owner config (never hardcoded), uses the
owner-defined capital as the base (not equity), and on any ambiguous input returns
a No-Trade result with an explicit reason — it never fabricates a price or quantity.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_DOWN
from typing import Any, Optional

# Owner-configuration env keys (read-only; capital is owner-authoritative,
# editable only outside market hours — enforcement is the settings layer's
# concern; P-SIZE only reads the current approved values).
ENV_CAPITAL = "STARTING_CAPITAL"
ENV_ALLOCATION = "POSITION_ALLOCATION_FRACTION"


@dataclass(frozen=True)
class CapitalSettings:
    """Owner-configured capital + allocation (read-only snapshot).

    `capital` is the owner-defined base (NON-compounding — not current equity).
    `allocation_fraction` is the owner-defined per-trade fraction of capital.
    """

    capital: Decimal
    allocation_fraction: Decimal

    @classmethod
    def from_env(cls) -> "CapitalSettings":
        """Read the current owner settings from configuration.

        Raises ValueError on missing/unparseable configuration (a deployment
        misconfiguration — fail fast). Semantically-invalid-but-parseable values
        (e.g. capital <= 0, allocation out of domain) are NOT raised here; they
        are surfaced as a No-Trade by `SizingPolicy.size` (never clamped).
        """
        raw_cap = os.environ.get(ENV_CAPITAL)
        raw_alloc = os.environ.get(ENV_ALLOCATION)
        if raw_cap in (None, ""):
            raise ValueError(f"{ENV_CAPITAL} is not set (owner capital required)")
        if raw_alloc in (None, ""):
            raise ValueError(
                f"{ENV_ALLOCATION} is not set (owner allocation required)"
            )
        try:
            capital = Decimal(str(raw_cap))
            allocation = Decimal(str(raw_alloc))
        except (InvalidOperation, ValueError) as exc:
            raise ValueError(
                f"unparseable capital/allocation config: {exc}"
            ) from exc
        # Reject non-finite config (NaN / +Infinity / -Infinity) — Decimal parses
        # these but they are never valid capital/allocation values (fail fast).
        if not capital.is_finite():
            raise ValueError(f"{ENV_CAPITAL} is non-finite ({capital})")
        if not allocation.is_finite():
            raise ValueError(f"{ENV_ALLOCATION} is non-finite ({allocation})")
        return cls(capital=capital, allocation_fraction=allocation)


@dataclass(frozen=True)
class SizingResult:
    """Outcome of a sizing computation (transient; not persisted)."""

    quantity: int          # whole shares; 0 when not tradable
    tradable: bool         # False => No Trade
    reason: str            # explicit reason (always set)
    capital_base: Decimal  # the capital used as the base
    allocation_value: Decimal  # capital × allocation_fraction (0 when invalid)

    @classmethod
    def no_trade(
        cls,
        reason: str,
        *,
        capital_base: Decimal = Decimal("0"),
        allocation_value: Decimal = Decimal("0"),
    ) -> "SizingResult":
        return cls(
            quantity=0,
            tradable=False,
            reason=reason,
            capital_base=capital_base,
            allocation_value=allocation_value,
        )


class SizingPolicy:
    """Fixed-allocation sizing. Deterministic, stateless, config-driven.

    Reads ONLY {capital, allocation, mark}. No risk/volatility/ATR/Kelly/dynamic
    inputs. The base is the owner-defined capital (non-compounding).
    """

    def size(
        self,
        candidate: Any,
        settings: CapitalSettings,
        mark: Optional[Decimal],
    ) -> SizingResult:
        """Compute order quantity for a risk-accepted candidate.

        `candidate` is contextual only (e.g. for the caller's audit); the
        quantity is derived SOLELY from settings.capital, settings.allocation_fraction
        and `mark` (requirement 13). Any ambiguous input → No Trade (explicit reason).
        """
        # -- price (mark) validation -------------------------------------- #
        if mark is None:
            return SizingResult.no_trade("missing mark")
        if not isinstance(mark, Decimal):
            return SizingResult.no_trade("invalid mark type")
        # Finiteness FIRST — guard NaN/+Inf/-Inf before any comparison so the
        # function never raises (InvalidOperation/OverflowError) on non-finite input.
        if not mark.is_finite():
            return SizingResult.no_trade(f"non-finite mark ({mark})")
        if mark <= Decimal("0"):
            return SizingResult.no_trade(f"invalid mark ({mark})")

        # -- capital validation (owner-defined; non-compounding base) ------ #
        capital = settings.capital
        if not capital.is_finite():
            return SizingResult.no_trade(f"non-finite capital ({capital})")
        if capital <= Decimal("0"):
            return SizingResult.no_trade(f"invalid capital ({capital})")

        # -- allocation validation (0 < fraction <= 1; never clamp) -------- #
        fraction = settings.allocation_fraction
        if not fraction.is_finite():
            return SizingResult.no_trade(
                f"non-finite allocation fraction ({fraction})", capital_base=capital
            )
        if fraction <= Decimal("0") or fraction > Decimal("1"):
            return SizingResult.no_trade(
                f"invalid allocation fraction ({fraction})", capital_base=capital
            )

        # -- fixed-allocation quantity (floor to whole shares) ------------- #
        allocation_value = capital * fraction
        units = allocation_value / mark
        quantity = int(units.to_integral_value(rounding=ROUND_DOWN))

        if quantity < 1:
            return SizingResult.no_trade(
                "unaffordable (allocation < 1 share at mark)",
                capital_base=capital,
                allocation_value=allocation_value,
            )

        return SizingResult(
            quantity=quantity,
            tradable=True,
            reason="ok",
            capital_base=capital,
            allocation_value=allocation_value,
        )


__all__ = [
    "CapitalSettings",
    "SizingResult",
    "SizingPolicy",
    "ENV_CAPITAL",
    "ENV_ALLOCATION",
]
