"""Capability boundary. DELETE and destructive operations are permanently denied."""
class PermissionEngine:
    BLOCKED={"DELETE","DESTRUCTIVE","DESTROY","PURGE","DROP","ERASE","REMOVE"}
    def authorize(self, operation, *, scope="", policy_ok=True):
        op=(operation or "").upper()
        blocked=op in self.BLOCKED or any(word in op for word in ("DELETE","DESTROY","ERASE","PURGE"))
        if blocked or not policy_ok:
            return {"status":"DENIED","operation":op,"reason":"DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED" if blocked else "POLICY_DENIED"}
        return {"status":"ALLOWED","operation":op,"scope":scope}
