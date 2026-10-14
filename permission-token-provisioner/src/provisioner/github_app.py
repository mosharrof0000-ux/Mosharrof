"""GitHub App installation-token adapter.

Issues short-lived installation tokens only after an external trusted approval
service authorizes and atomically consumes an exact approval. The raw token is
never returned to callers; a configured vault must store it.
"""
from __future__ import annotations
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Mapping, Protocol, Sequence
from .policy import Action, Approval, Decision, Request, evaluate

class ApprovalService(Protocol):
    def authorize_and_consume(self, request: Request, approval: Approval) -> bool:
        """Authenticate owner approval, match exact scope, and consume it atomically."""

class SecretVault(Protocol):
    def store_secret(self, *, name: str, value: str, expires_at: str, metadata: Mapping[str, str]) -> str:
        """Persist secret and return an opaque handle; never log the value."""

@dataclass(frozen=True)
class IssuedCredential:
    provider: str
    handle: str
    expires_at: str
    permissions: Mapping[str, str]
    resource_scope: str

class ProvisioningDenied(RuntimeError):
    pass

class GitHubAppAdapter:
    API_ROOT = "https://api.github.com"
    ALLOWED_LEVELS = frozenset({"read", "write"})
    ALLOWED_PERMISSIONS = frozenset({
        "actions", "administration", "checks", "contents", "deployments",
        "discussions", "issues", "metadata", "packages", "pages",
        "pull_requests", "repository_hooks", "statuses", "workflows",
    })

    def __init__(self, *, approval_service: ApprovalService, vault: SecretVault,
                 app_id: str | None = None, installation_id: str | None = None,
                 private_key: str | None = None, opener: Any = urllib.request.urlopen,
                 clock: Any = time.time) -> None:
        self.app_id = app_id or os.getenv("GITHUB_APP_ID", "")
        self.installation_id = installation_id or os.getenv("GITHUB_APP_INSTALLATION_ID", "")
        self.private_key = private_key or os.getenv("GITHUB_APP_PRIVATE_KEY", "")
        self.approval_service, self.vault = approval_service, vault
        self.opener, self.clock = opener, clock

    def issue_token(self, *, request: Request, approval: Approval,
                    permissions: Mapping[str, str], repository_ids: Sequence[int]) -> IssuedCredential:
        if request.provider != "github" or request.action is not Action.CREATE_CREDENTIAL:
            raise ProvisioningDenied("request_not_for_github_credential_creation")
        if request.environment == "production":
            raise ProvisioningDenied("production_provisioning_disabled")
        if not self.app_id or not self.installation_id or not self.private_key:
            raise ProvisioningDenied("github_app_bootstrap_missing")
        if not repository_ids or any(not isinstance(i, int) or i <= 0 for i in repository_ids):
            raise ProvisioningDenied("explicit_repository_ids_required")
        expected_scope = "repository_ids:" + ",".join(str(i) for i in repository_ids)
        if request.resource_scope != expected_scope or approval.resource_scope != expected_scope:
            raise ProvisioningDenied("repository_scope_does_not_match_approval")
        if not permissions or set(permissions) - self.ALLOWED_PERMISSIONS:
            raise ProvisioningDenied("unknown_or_empty_permission_set")
        if any(level not in self.ALLOWED_LEVELS for level in permissions.values()):
            raise ProvisioningDenied("permission_level_not_allowed")
        normalized = frozenset(f"{name}:{level}" for name, level in permissions.items())
        if normalized != request.permission_set:
            raise ProvisioningDenied("requested_permissions_do_not_match_approved_scope")
        if not self.approval_service.authorize_and_consume(request, approval):
            raise ProvisioningDenied("owner_approval_invalid_or_already_used")
        result = evaluate(request, approval=approval, approval_authentic=True)
        if result.decision is not Decision.ALLOW:
            raise ProvisioningDenied(result.reason)
        token = self._create_installation_token(permissions, repository_ids)
        handle = self.vault.store_secret(
            name=f"github-installation-{self.installation_id}", value=token["token"],
            expires_at=token["expires_at"],
            metadata={"provider": "github", "installation_id": self.installation_id,
                      "repository_ids": ",".join(str(i) for i in repository_ids),
                      "permissions": json.dumps(dict(permissions), sort_keys=True),
                      "environment": request.environment},
        )
        if not handle or not isinstance(handle, str):
            raise ProvisioningDenied("vault_did_not_return_opaque_handle")
        return IssuedCredential("github", handle, token["expires_at"], dict(permissions),
                                "repository_ids:" + ",".join(str(i) for i in repository_ids))

    def _create_installation_token(self, permissions: Mapping[str, str],
                                   repository_ids: Sequence[int]) -> Mapping[str, str]:
        try:
            import jwt
        except ImportError as exc:
            raise ProvisioningDenied("PyJWT_dependency_missing") from exc
        now = int(self.clock())
        app_jwt = jwt.encode({"iat": now - 30, "exp": now + 8 * 60, "iss": self.app_id},
                             self.private_key, algorithm="RS256")
        payload = {"repository_ids": list(repository_ids), "permissions": dict(permissions)}
        request = urllib.request.Request(
            f"{self.API_ROOT}/app/installations/{self.installation_id}/access_tokens",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Accept": "application/vnd.github+json", "Authorization": f"Bearer {app_jwt}",
                     "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with self.opener(request, timeout=15) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise ProvisioningDenied("github_installation_token_request_failed") from exc
        if not isinstance(data, dict) or not data.get("token") or not data.get("expires_at"):
            raise ProvisioningDenied("github_response_missing_token_or_expiry")
        if not isinstance(data.get("permissions"), dict):
            raise ProvisioningDenied("github_response_missing_permissions")
        returned_permissions = data["permissions"]
        if any(returned_permissions.get(k) != v for k, v in permissions.items()):
            raise ProvisioningDenied("provider_granted_permissions_do_not_match_request")
        # GitHub may include implicit metadata:read. Reject every other unrequested
        # permission so the adapter never silently accepts scope expansion.
        extras = {k: v for k, v in returned_permissions.items() if k not in permissions}
        if any(k != "metadata" or v != "read" for k, v in extras.items()):
            raise ProvisioningDenied("provider_returned_unrequested_permissions")
        from datetime import datetime, timezone
        try:
            expiry = datetime.fromisoformat(str(data["expires_at"]).replace("Z", "+00:00"))
        except ValueError as exc:
            raise ProvisioningDenied("github_response_invalid_expiry") from exc
        if expiry.tzinfo is None or expiry <= datetime.now(timezone.utc):
            raise ProvisioningDenied("github_response_expiry_not_in_future")
        return {"token": data["token"], "expires_at": data["expires_at"]}
