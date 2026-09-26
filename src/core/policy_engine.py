"""Central policy checks shared by every entity."""
class PolicyEngine:
    def check(self, *, operation, scope, entity_scope):
        if operation.upper() in {"DELETE","DESTRUCTIVE"}: return {"allowed":False,"reason":"PERMANENT_DELETE_BLOCK"}
        if entity_scope and scope and not scope.startswith(entity_scope): return {"allowed":False,"reason":"SCOPE_BOUNDARY"}
        return {"allowed":True,"reason":"POLICY_OK"}
