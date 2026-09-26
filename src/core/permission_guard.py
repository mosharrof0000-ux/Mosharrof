"""Central capability guard for entity and operation boundaries."""

from typing import Dict, Any


class PermissionDenied(PermissionError):
    pass


class PermissionGuard:
    BLOCKED_OPERATIONS = frozenset({
        "DELETE", "DESTRUCTIVE", "DESTROY", "PURGE",
        "DROP", "ERASE", "REMOVE", "DELETE_FILE", "DELETE_DIRECTORY",
        "DROP_DATABASE", "DESTROY_PROJECT",
    })

    def __init__(self):
        self.audit_events = []

    def check(
        self,
        operation: str,
        *,
        scope: str = "entity",
        entity_scope: str = "",
        destructive: bool = False,
    ) -> Dict[str, Any]:
        op = (operation or "").strip().upper()
        if op in self.BLOCKED_OPERATIONS or destructive:
            result = {
                "status": "DENIED",
                "operation": op,
                "scope": scope,
                "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED",
            }
        elif entity_scope and scope and not (
            scope == entity_scope or scope.startswith(entity_scope + "/")
        ):
            result = {
                "status": "DENIED",
                "operation": op,
                "scope": scope,
                "reason": "SCOPE_BOUNDARY",
            }
        else:
            result = {
                "status": "ALLOWED",
                "operation": op,
                "scope": scope,
            }
        self.audit_events.append(result)
        return result

    def require(self, operation: str, **kwargs) -> None:
        result = self.check(operation, **kwargs)
        if result["status"] != "ALLOWED":
            raise PermissionDenied(result["reason"])
