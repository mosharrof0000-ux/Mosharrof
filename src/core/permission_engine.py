"""Capability boundary. DELETE and destructive operations are permanently denied."""
class PermissionEngine:
    BLOCKED={"DELETE","DESTRUCTIVE"}
    def authorize(self, operation, *, scope="", policy_ok=True):
        op=(operation or "").upper()
        if op in self.BLOCKED or not policy_ok:
            return {"status":"DENIED","operation":op,"reason":"DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED" if op in self.BLOCKED else "POLICY_DENIED"}
        return {"status":"ALLOWED","operation":op,"scope":scope}
