"""Central capability boundary for Mosharrof.

DELETE and explicitly destructive operations are permanently denied.
"""

from typing import Any, Dict


class PermissionGuard:
    PERMANENTLY_DENIED = {"DELETE"}

    def check(self, operation: str, destructive: bool = False) -> Dict[str, Any]:
        op = (operation or "").strip().upper()
        if op in self.PERMANENTLY_DENIED or destructive:
            return {
                "status": "DENIED",
                "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED",
            }
        return {"status": "ALLOWED", "operation": op}
