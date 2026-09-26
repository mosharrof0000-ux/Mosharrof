"""Central capability guard. DELETE and destructive operations are permanently denied."""
class PermissionGuard:
    def check(self, operation: str, destructive: bool=False):
        op=(operation or "").upper().strip()
        if op=="DELETE" or destructive:
            return {"status":"DENIED","reason":"DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}
        return {"status":"ALLOWED","operation":op}
