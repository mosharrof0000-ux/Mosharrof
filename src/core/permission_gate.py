"""Capability gate for Mosharrof tools. DELETE and destructive operations are never granted."""

from dataclasses import dataclass


@dataclass(frozen=True)
class CapabilityDecision:
    allowed: bool
    reason: str


class PermissionGate:
    BLOCKED_OPERATIONS = frozenset({
        "DELETE",
        "DESTRUCTIVE",
        "DESTROY",
        "REMOVE",
        "ERASE",
    })

    def check(self, operation: str) -> CapabilityDecision:
        normalized = (operation or "").strip().upper()
        if normalized in self.BLOCKED_OPERATIONS:
            return CapabilityDecision(False, "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED")
        return CapabilityDecision(True, "ALLOWED_BY_FOUNDATION_POLICY")
