"""Pure policy checks for the isolated credential provisioner.

This module does not mint tokens, authenticate users, or persist secrets.
Callers must validate approval authenticity using a trusted approval service
and persist consumed approval IDs atomically before executing a provider action.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import FrozenSet


class Decision(str, Enum):
    ALLOW = "allow"
    APPROVAL_REQUIRED = "approval_required"
    DENY = "deny"


class Action(str, Enum):
    SELECT_CREDENTIAL = "select_credential"
    READ_ONLY_HEALTH_CHECK = "read_only_health_check"
    CREATE_CREDENTIAL = "create_credential"
    WRITE_SECRET = "write_secret"
    CHANGE_PERMISSIONS = "change_permissions"
    ROTATE_CREDENTIAL = "rotate_credential"
    REVOKE_CREDENTIAL = "revoke_credential"
    DELETE_CREDENTIAL = "delete_credential"
    PRODUCTION_CONNECT = "production_connect"
    PROVIDER_WRITE = "provider_write"


PRIVILEGED_ACTIONS: FrozenSet[Action] = frozenset({
    Action.CREATE_CREDENTIAL,
    Action.WRITE_SECRET,
    Action.CHANGE_PERMISSIONS,
    Action.ROTATE_CREDENTIAL,
    Action.REVOKE_CREDENTIAL,
    Action.DELETE_CREDENTIAL,
    Action.PRODUCTION_CONNECT,
    Action.PROVIDER_WRITE,
})


@dataclass(frozen=True)
class Request:
    provider: str
    action: Action
    permission_set: FrozenSet[str]
    resource_scope: str
    environment: str
    capability: str

    def __post_init__(self) -> None:
        for field_name in ("provider", "resource_scope", "environment", "capability"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty")
        if not self.permission_set or any(not p.strip() for p in self.permission_set):
            raise ValueError("permission_set must contain non-empty permissions")
        if self.environment not in {"test", "staging", "production"}:
            raise ValueError("unknown environment")


@dataclass(frozen=True)
class Approval:
    approval_id: str
    provider: str
    action: Action
    permission_set: FrozenSet[str]
    resource_scope: str
    environment: str
    capability: str
    expires_at: datetime


@dataclass(frozen=True)
class PolicyResult:
    decision: Decision
    reason: str


def evaluate(
    request: Request,
    *,
    approval: Approval | None = None,
    approval_authentic: bool = False,
    approval_already_used: bool = False,
    now: datetime | None = None,
) -> PolicyResult:
    """Evaluate a request without side effects; fail closed on ambiguity.

    The caller must separately atomically consume a valid approval ID before
    performing the action. This function is not a substitute for identity,
    approval-signature validation, provider authorization, or a vault.
    """
    if request.action in {Action.SELECT_CREDENTIAL, Action.READ_ONLY_HEALTH_CHECK}:
        if request.environment == "production":
            # Production access is intentionally not enabled by this scaffold.
            return PolicyResult(Decision.DENY, "production_not_enabled_in_scaffold")
        return PolicyResult(Decision.ALLOW, "non_production_read_only_action")

    if request.action not in PRIVILEGED_ACTIONS:
        return PolicyResult(Decision.DENY, "unknown_or_unclassified_action")

    if approval is None:
        return PolicyResult(Decision.APPROVAL_REQUIRED, "owner_approval_required")
    if not approval_authentic:
        return PolicyResult(Decision.DENY, "approval_not_authenticated")
    if approval_already_used:
        return PolicyResult(Decision.DENY, "approval_replay_detected")

    expected = (
        request.provider,
        request.action,
        request.permission_set,
        request.resource_scope,
        request.environment,
        request.capability,
    )
    actual = (
        approval.provider,
        approval.action,
        approval.permission_set,
        approval.resource_scope,
        approval.environment,
        approval.capability,
    )
    if actual != expected:
        return PolicyResult(Decision.DENY, "approval_scope_mismatch")

    current = now or datetime.now(timezone.utc)
    expiry = approval.expires_at
    if expiry.tzinfo is None:
        return PolicyResult(Decision.DENY, "approval_expiry_must_be_timezone_aware")
    if expiry <= current:
        return PolicyResult(Decision.DENY, "approval_expired")

    return PolicyResult(Decision.ALLOW, "exact_scoped_approval_valid")
