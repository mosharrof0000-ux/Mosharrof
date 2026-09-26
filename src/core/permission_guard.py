"""Central capability guard for entity and operation boundaries."""
class PermissionGuard:
    BLOCKED_OPERATIONS = {"DELETE","DESTROY","PURGE","DROP","ERASE","REMOVE"}

    def check(self, operation: str, *, scope: str = "entity",
              entity_scope: str = "", destructive: bool = False):
        op = (operation or "").strip().upper()
        if op in self.BLOCKED_OPERATIONS or destructive:
            return {"status":"DENIED","operation":op,"scope":scope,
                    "reason":"DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}
        if entity_scope and scope and not (scope == entity_scope or scope.startswith(entity_scope + "/")):
            return {"status":"DENIED","operation":op,"scope":scope,
                    "reason":"SCOPE_BOUNDARY"}
        return {"status":"ALLOWED","operation":op,"scope":scope}
