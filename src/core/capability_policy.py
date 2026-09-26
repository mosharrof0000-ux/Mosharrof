"""Central capability guard for Mosharrof foundation."""

from typing import Iterable

BLOCKED_OPERATIONS = frozenset({"DELETE", "DESTROY", "DESTRUCTIVE"})


def authorize(operation: str, allowed_operations: Iterable[str]) -> bool:
    op = operation.strip().upper()
    if op in BLOCKED_OPERATIONS:
        return False
    return op in {item.strip().upper() for item in allowed_operations}
