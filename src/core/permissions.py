from dataclasses import dataclass
from typing import Iterable

@dataclass(frozen=True)
class PermissionDecision:
    allowed: bool
    reason: str

class PermissionGate:
    """Hard capability boundary. DELETE/destructive operations can never pass."""

    PERMANENT_DENY = frozenset({"DELETE", "DESTRUCTIVE"})

    def __init__(self, allowed: Iterable[str] = ()):
        self.allowed = {str(item).upper() for item in allowed}

    def check(self, operation: str) -> PermissionDecision:
        op = str(operation).upper()
        if op in self.PERMANENT_DENY:
            return PermissionDecision(False, "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED")
        if op in self.allowed:
            return PermissionDecision(True, "ALLOWED_BY_PROFILE")
        return PermissionDecision(False, "NOT_GRANTED_BY_PROFILE")
