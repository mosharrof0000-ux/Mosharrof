"""Central capability guard for Mosharrof entity boundaries.

Model intelligence never grants authority by itself. Identity, permission,
policy and scope remain the capability boundary. DELETE/destructive operations
are permanently denied.
"""

class PermissionGuard:
    BLOCKED_OPERATIONS = {
        "DELETE", "DELETE_FILE", "DELETE_DIRECTORY", "DESTRUCTIVE",
        "DESTROY", "DESTROY_PROJECT", "PURGE", "DROP", "DROP_DATABASE",
        "ERASE", "REMOVE"
    }

    DEFAULT_PERMISSIONS = {
        "core": {"READ", "WRITE", "EXECUTE", "COORDINATE", "REGISTER", "AUDIT"},
        "chat": {"READ", "MESSAGE"},
        "sidebar": {"READ", "RENDER"},
        "ui": {"READ", "RENDER"},
        "voice": {"READ", "PROCESS"},
        "storage": {"READ", "ORGANIZE"},
        "tool_factory": {"READ", "CREATE_TOOL", "EXECUTE_TOOL"},
        "quran_research": {"READ", "RESEARCH"},
    }

    def __init__(self, profile: str = "core", allowed=()):
        self.profile = profile
        self.allowed = {str(item).strip().upper() for item in allowed}

    def check(self, operation: str, *, scope: str = "entity",
              entity_scope: str = "", destructive: bool = False):
        op = (operation or "").strip().upper()
        entity = (entity_scope or "").strip().lower()

        if destructive or op in self.BLOCKED_OPERATIONS:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}

        if self.allowed and op not in self.allowed:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "OPERATION_NOT_IN_PERMISSION_SCOPE"}

        if entity in self.DEFAULT_PERMISSIONS and op not in self.DEFAULT_PERMISSIONS[entity]:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "OPERATION_NOT_IN_ENTITY_PERMISSION"}

        if entity and scope and not (scope == entity or scope.startswith(entity + "/")):
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "SCOPE_BOUNDARY"}

        return {"status": "ALLOWED", "operation": op, "scope": scope}
