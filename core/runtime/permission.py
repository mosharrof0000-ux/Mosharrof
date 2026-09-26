from dataclasses import dataclass
from typing import Iterable

PERMANENT_DENIALS = {"DELETE", "DESTRUCTIVE_OPERATION"}

@dataclass(frozen=True)
class PermissionDecision:
    allowed: bool
    reason: str

class PermissionGate:
    def __init__(self, allowed_operations: Iterable[str] = ()):
        self.allowed_operations = {op.upper() for op in allowed_operations}

    def check(self, operation: str) -> PermissionDecision:
        op = operation.upper().strip()
        if op in PERMANENT_DENIALS:
            return PermissionDecision(False, "PERMANENTLY_DENIED")
        if op not in self.allowed_operations:
            return PermissionDecision(False, "NOT_GRANTED")
        return PermissionDecision(True, "ALLOWED")
