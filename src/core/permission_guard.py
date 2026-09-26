"""Central capability guard for entity and operation boundaries.

The guard is intentionally conservative: model intelligence never grants
authority by itself. Identity, permission scope and policy remain the boundary.
DELETE and destructive operations are permanently denied.
"""

from typing import Iterable


class PermissionGuard:
    BLOCKED_OPERATIONS = {
        "DELETE",
        "DELETE_FILE",
        "DELETE_DIRECTORY",
        "DESTRUCTIVE",
        "DESTROY",
        "DESTROY_PROJECT",
        "PURGE",
        "DROP",
        "DROP_DATABASE",
        "ERASE",
        "REMOVE",
    }

    def __init__(self, profile: str = "core", allowed: Iterable[str] = ()):
        self.profile = profile
        self.allowed = {str(item).strip().upper() for item in allowed}

    def check(
        self,
        operation: str,
        *,
        scope: str = "entity",
        entity_scope: str = "",
        destructive: bool = False,
    ):
        op = (operation or "").strip().upper()

        if destructive or op in self.BLOCKED_OPERATIONS:
            return {
                "status": "DENIED",
                "operation": op,
                "scope": scope,
                "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED",
            }

        if self.allowed and op not in self.allowed:
            return {
                "status": "DENIED",
                "operation": op,
                "scope": scope,
                "reason": "OPERATION_NOT_IN_PERMISSION_SCOPE",
            }

        if (
            entity_scope
            and scope
            and not (scope == entity_scope or scope.startswith(entity_scope + "/"))
        ):
            return {
                "status": "DENIED",
                "operation": op,
                "scope": scope,
                "reason": "SCOPE_BOUNDARY",
            }

        return {"status": "ALLOWED", "operation": op, "scope": scope}
