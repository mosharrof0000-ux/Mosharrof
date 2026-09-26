"""Central capability boundary. DELETE and destructive actions are permanently denied."""

from dataclasses import dataclass
from typing import FrozenSet


@dataclass(frozen=True)
class PermissionDecision:
    allowed: bool
    reason: str


class PermissionEngine:
    DENIED_OPERATIONS: FrozenSet[str] = frozenset({"DELETE", "DESTROY", "DROP", "PURGE"})

    def check(self, operation: str, destructive: bool = False) -> PermissionDecision:
        op = operation.strip().upper()
        if destructive or op in self.DENIED_OPERATIONS:
            return PermissionDecision(False, "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED")
        return PermissionDecision(True, "ALLOWED_BY_OPERATION_POLICY")
