"""Central capability guard. DELETE and destructive operations are permanently denied."""

from typing import Any, Dict


class PermissionGuard:
    def __init__(self, allow_delete: bool = False):
        self.allow_delete = False

    def check(self, operation: str, destructive: bool = False) -> Dict[str, Any]:
        op = operation.upper().strip()
        if op == "DELETE" or destructive:
            return {
                "status": "DENIED",
                "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"
            }
        return {"status": "ALLOWED", "operation": op}
