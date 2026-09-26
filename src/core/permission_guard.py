"""Hard permission boundary. DELETE/destructive operations are permanently denied."""
from typing import Any, Dict

class PermissionGuard:
    PERMANENT_DENIALS = {"DELETE", "DESTRUCTIVE_OPERATION"}

    def authorize(self, operation: str, profile: Dict[str, Any]) -> Dict[str, Any]:
        op = operation.upper()
        if op in self.PERMANENT_DENIALS:
            return {"status":"DENIED","reason":"PERMANENT_DELETE_AND_DESTRUCTIVE_DENIAL"}
        if op in set(profile.get("deny", [])):
            return {"status":"DENIED","reason":"POLICY_DENIAL"}
        if op not in set(profile.get("allow", [])):
            return {"status":"DENIED","reason":"OUT_OF_SCOPE"}
        return {"status":"ALLOWED","reason":"POLICY_ALLOWED"}
