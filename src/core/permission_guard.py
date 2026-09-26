"""Central capability guard for entity and operation boundaries."""
class PermissionGuard:
    BLOCKED_OPERATIONS = {"DELETE", "DESTRUCTIVE", "DESTROY", "PURGE", "DROP", "ERASE", "REMOVE"}

    def __init__(self, profile: str = "core", allowed=None):
        self.profile = profile
        self.allowed = {str(item).upper() for item in allowed} if allowed is not None else None

    def check(self, operation: str, *, scope: str = "entity",
              entity_scope: str = "", destructive: bool = False):
        op = (operation or "").strip().upper()
        if op in self.BLOCKED_OPERATIONS or destructive:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}
        if self.allowed is not None and op not in self.allowed:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "PERMISSION_PROFILE_DENIED", "profile": self.profile}
        if entity_scope and scope and not (scope == entity_scope or scope.startswith(entity_scope + "/")):
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "SCOPE_BOUNDARY"}
        return {"status": "ALLOWED", "operation": op, "scope": scope,
                "profile": self.profile}
