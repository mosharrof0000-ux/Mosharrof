"""Central capability guard. DELETE and destructive operations are permanently denied."""
class PermissionGuard:
    BLOCKED_OPERATIONS = {"DELETE","DESTROY","PURGE","DROP","ERASE","REMOVE"}
    def check(self, operation: str, *, scope: str = "entity", destructive: bool = False):
        op=(operation or "").strip().upper()
        if op in self.BLOCKED_OPERATIONS or destructive:
            return {"status":"DENIED","operation":op,"scope":scope,"reason":"DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}
        return {"status":"ALLOWED","operation":op,"scope":scope}
