"""Hard capability policy for Mosharrof.

DELETE and destructive operations are denied regardless of caller or model.
Temporary permissions must be explicit, scoped, audited, and revocable.
"""

FORBIDDEN_OPERATIONS = frozenset({"DELETE", "DESTRUCTIVE", "DESTROY", "PURGE", "ERASE"})

def authorize(operation: str, *, destructive: bool = False) -> dict:
    op = (operation or "").strip().upper()
    if destructive or op in FORBIDDEN_OPERATIONS:
        return {"status": "DENIED", "operation": op, "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}
    return {"status": "ALLOWED", "operation": op, "reason": "WITHIN_CORE_POLICY"}

def capability(model: str, permission: str, policy: str, scope: str) -> dict:
    return {"model": model, "permission": permission, "policy": policy, "scope": scope}
