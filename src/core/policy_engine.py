"""Central policy checks shared by every entity."""
class PolicyEngine:
    def check(self, *, operation, scope, entity_scope):
        op=(operation or "").upper()
        if op in {"DELETE","DESTRUCTIVE","DESTROY","PURGE","DROP","ERASE","REMOVE"} or any(w in op for w in ("DELETE","DESTROY","ERASE","PURGE")):
            return {"allowed":False,"reason":"PERMANENT_DELETE_BLOCK"}
        if entity_scope and scope and not (scope==entity_scope or scope.startswith(entity_scope+"/")):
            return {"allowed":False,"reason":"SCOPE_BOUNDARY"}
        return {"allowed":True,"reason":"POLICY_OK"}
