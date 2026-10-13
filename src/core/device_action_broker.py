"""Per-action, fail-closed broker for sensitive device and automation actions.

This module is an enforcement primitive, not a claim that every platform adapter
is already wired into the MOSHARROF runtime. Callers must provide trusted
authorization, fresh approval, execution and independent verification hooks.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Mapping
import re
import uuid


Authorize = Callable[..., Mapping[str, Any]]
ApprovalCheck = Callable[[str, str, str, str, Any], bool]
Operation = Callable[[], Any]
Verifier = Callable[[Any], bool]
AuditSink = Callable[[Mapping[str, Any]], None]

# Keep this deny-list independent of the registry so a broad grant cannot bypass it.
_BLOCKED_CAPABILITY = re.compile(
    r"(^|[._-])(delete|destroy|wipe|format|factory_reset|purge)([._-]|$)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ActionResult:
    action_id: str
    status: str
    reason: str
    verified: bool
    result: Any = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "action_id": self.action_id,
            "status": self.status,
            "reason": self.reason,
            "verified": self.verified,
            "result": self.result,
        }


class DeviceActionBroker:
    """Run one explicitly approved action and verify its outcome.

    The broker never infers approval from a standing permission grant. Approval
    is bound to action_id, capability, entity, and exact resource scope. Audit
    events contain only identifiers, status, and timing metadata—not tokens,
    arguments, result payloads, or exception messages.
    """

    def __init__(
        self,
        *,
        authorize: Authorize,
        approval_check: ApprovalCheck,
        audit_sink: AuditSink | None = None,
    ) -> None:
        self._authorize = authorize
        self._approval_check = approval_check
        self._audit_sink = audit_sink or (lambda event: None)

    def _audit(
        self, *, action_id: str, capability: str, entity_id: str,
        resource_scope: str, status: str, reason: str, started_at: str,
    ) -> bool:
        event = {
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "started_at": started_at,
            "action_id": action_id,
            "capability": capability,
            "entity_id": entity_id,
            "scope_present": bool(resource_scope),
            "status": status,
            "reason": reason,
        }
        try:
            self._audit_sink(event)
            return True
        except Exception:
            # Never claim a fully successful action when its audit write failed.
            return False

    def execute(
        self,
        *,
        capability: str,
        entity_id: str,
        resource_scope: str,
        approval_token: Any,
        operation: Operation,
        verifier: Verifier,
        destructive: bool = False,
        action_id: str | None = None,
    ) -> dict[str, Any]:
        action_id = action_id or str(uuid.uuid4())
        started_at = datetime.now(timezone.utc).isoformat()
        capability = (capability or "").strip().lower()
        entity_id = (entity_id or "").strip()
        resource_scope = (resource_scope or "").strip()

        def finish(status: str, reason: str, verified: bool = False,
                   result: Any = None) -> dict[str, Any]:
            audit_ok = self._audit(
                action_id=action_id, capability=capability, entity_id=entity_id,
                resource_scope=resource_scope, status=status, reason=reason,
                started_at=started_at,
            )
            if not audit_ok and status == "SUCCESS":
                return ActionResult(
                    action_id, "UNVERIFIED", "AUDIT_WRITE_FAILED_AFTER_ACTION",
                    False, result,
                ).as_dict()
            return ActionResult(action_id, status, reason, verified, result).as_dict()

        if not capability or not entity_id or not resource_scope:
            return finish("DENIED", "MISSING_ACTION_CONTEXT")
        if destructive or _BLOCKED_CAPABILITY.search(capability):
            return finish("DENIED", "PERMANENT_SAFETY_BLOCK")
        if not callable(operation) or not callable(verifier):
            return finish("DENIED", "MISSING_EXECUTION_OR_VERIFIER")
        try:
            approved = self._approval_check(
                action_id, capability, entity_id, resource_scope, approval_token
            )
        except Exception:
            approved = False
        if not approved:
            return finish("DENIED", "FRESH_ACTION_APPROVAL_REQUIRED")

        try:
            decision = self._authorize(
                capability,
                entity_id=entity_id,
                resource_scope=resource_scope,
                approval_token=approval_token,
            )
        except Exception:
            decision = {"status": "DENIED", "reason": "AUTHORIZATION_SERVICE_ERROR"}
        if not isinstance(decision, Mapping) or decision.get("status") != "ALLOWED":
            reason = "AUTHORIZATION_DENIED"
            if isinstance(decision, Mapping):
                reason = str(decision.get("reason") or reason)[:80]
            return finish("DENIED", reason)

        try:
            result = operation()
        except Exception:
            return finish("FAILED", "OPERATION_FAILED")

        try:
            verified = bool(verifier(result))
        except Exception:
            verified = False
        if not verified:
            return finish("UNVERIFIED", "RESULT_VERIFICATION_FAILED", result=result)

        return finish("SUCCESS", "ACTION_COMPLETED_AND_VERIFIED", True, result)
