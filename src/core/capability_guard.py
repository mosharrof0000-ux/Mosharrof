"""Non-destructive capability guard for Mosharrof tools."""

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class PermissionContext:
    scope: str = "project"
    allow_create: bool = True
    allow_execute: bool = True


DENIED_OPERATIONS = frozenset({"DELETE", "DESTRUCTIVE"})

# This is a boundary check, not a security sandbox. Runtime isolation is
# required before executing untrusted generated code.
DANGEROUS_PATTERNS = (
    r"\bos\.remove\b",
    r"\bos\.unlink\b",
    r"\bshutil\.rmtree\b",
    r"\bPath\([^\n]+\)\.unlink\b",
    r"\bsubprocess\.(run|Popen|call)\b",
)


def authorize(operation: str, permission: PermissionContext) -> None:
    op = operation.upper().strip()
    if op in DENIED_OPERATIONS:
        raise PermissionError("DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED")
    if op == "CREATE_TOOL" and not permission.allow_create:
        raise PermissionError("TOOL_CREATE_NOT_PERMITTED")
    if op == "EXECUTE_TOOL" and not permission.allow_execute:
        raise PermissionError("TOOL_EXECUTION_NOT_PERMITTED")


def validate_generated_code(code_body: str) -> None:
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, code_body):
            raise PermissionError("GENERATED_TOOL_CONTAINS_BLOCKED_OPERATION")
