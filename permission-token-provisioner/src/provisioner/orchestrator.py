"""Fail-closed orchestration seam between task intent, credential router, and provisioner.

This module deliberately does not authenticate an owner, sign approvals, access a vault,
or call provider APIs itself. Production callers must inject trusted implementations for
those boundaries. It never treats a natural-language statement as an approval.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping, Protocol

from .policy import Action, Approval, Request


_SECRET_KEY_PARTS = ("token", "secret", "password", "private_key", "authorization", "cookie", "credential_value")


def _redact(value: Any) -> Any:
    """Recursively remove likely secret-bearing fields from provider results."""
    if isinstance(value, Mapping):
        return {
            str(key): ("[REDACTED]" if any(part in str(key).lower() for part in _SECRET_KEY_PARTS)
                       else _redact(item))
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_redact(item) for item in value]
    return value


@dataclass(frozen=True)
class TaskIntent:
    """Structured, already-classified intent; never construct from untrusted text alone."""
    request: Request
    operation_id: str
    options: Mapping[str, Any]


@dataclass(frozen=True)
class Plan:
    status: str
    operation_id: str
    provider: str
    action: str
    resource_scope: str
    permission_set: tuple[str, ...]
    environment: str
    reason: str
    credential_handle: str | None = None
    result: Mapping[str, Any] | None = None


class CredentialRouter(Protocol):
    def select_credential(self, request: Request) -> str | None: ...
    def execute(self, request: Request, *, credential_handle: str) -> Mapping[str, Any]: ...


class Provisioner(Protocol):
    def provision(self, *, request: Request, approval: Approval,
                  options: Mapping[str, Any]) -> Mapping[str, Any]: ...


class ApprovalVerifier(Protocol):
    def verify_and_consume(self, *, request: Request, approval: Approval) -> bool: ...


class PermissionActionOrchestrator:
    """Use a valid existing credential when possible; mint only after exact approval.

    This is a server-side orchestration primitive, not a public HTTP endpoint. The host
    must authenticate the owner and build Request/Approval objects from trusted data.
    """
    def __init__(self, *, router: CredentialRouter, provisioner: Provisioner,
                 approval_verifier: ApprovalVerifier):
        self._router = router
        self._provisioner = provisioner
        self._approval_verifier = approval_verifier

    def run(self, *, intent: TaskIntent, approval: Approval | None = None) -> Plan:
        request = intent.request
        if not intent.operation_id.strip():
            return self._plan(intent, "DENIED", "operation_id_required")

        # Production is intentionally unavailable until production controls are integrated.
        if request.environment == "production":
            return self._plan(intent, "DENIED", "production_integration_not_enabled")

        if request.action in {Action.SELECT_CREDENTIAL, Action.READ_ONLY_HEALTH_CHECK}:
            try:
                handle = self._router.select_credential(request)
            except Exception:
                return self._plan(intent, "FAILED", "credential_selection_failed")
            if not isinstance(handle, str) or not handle.startswith("vault://"):
                return self._plan(intent, "APPROVAL_REQUIRED", "no_eligible_existing_credential")
            try:
                result = self._router.execute(request, credential_handle=handle)
            except Exception:
                # Do not include provider exceptions: they can contain secrets.
                return self._plan(intent, "FAILED", "credential_execution_failed")
            return self._plan(intent, "COMPLETED", "existing_credential_used",
                              credential_handle=handle, result=_redact(result))

        if request.action not in {
            Action.CREATE_CREDENTIAL, Action.WRITE_SECRET, Action.CHANGE_PERMISSIONS,
            Action.ROTATE_CREDENTIAL, Action.REVOKE_CREDENTIAL, Action.DELETE_CREDENTIAL,
            Action.PROVIDER_WRITE, Action.PRODUCTION_CONNECT,
        }:
            return self._plan(intent, "DENIED", "unclassified_action")

        if approval is None:
            return self._plan(intent, "APPROVAL_REQUIRED", "owner_approval_required")

        try:
            valid = self._approval_verifier.verify_and_consume(request=request, approval=approval)
        except Exception:
            return self._plan(intent, "DENIED", "approval_verification_unavailable")
        if not valid:
            return self._plan(intent, "DENIED", "approval_invalid_or_replayed")

        try:
            credential = self._provisioner.provision(
                request=request, approval=approval, options=intent.options
            )
        except Exception:
            # Never surface raw adapter/provider errors or token values to the caller.
            return self._plan(intent, "FAILED", "credential_provisioning_failed")

        handle = credential.get("handle")
        if not isinstance(handle, str) or not handle.startswith("vault://"):
            return self._plan(intent, "FAILED", "provisioner_did_not_return_opaque_vault_handle")
        return self._plan(intent, "READY", "credential_created_and_stored",
                          credential_handle=handle, result=_redact(credential))

    @staticmethod
    def _plan(intent: TaskIntent, status: str, reason: str, *,
              credential_handle: str | None = None,
              result: Mapping[str, Any] | None = None) -> Plan:
        request = intent.request
        return Plan(status=status, operation_id=intent.operation_id,
                    provider=request.provider, action=request.action.value,
                    resource_scope=request.resource_scope,
                    permission_set=tuple(sorted(request.permission_set)),
                    environment=request.environment, reason=reason,
                    credential_handle=credential_handle, result=result)
