"""Central fail-closed dispatcher for supported provider adapters."""
from __future__ import annotations
from typing import Any, Mapping

from .policy import Action, Approval, Request
from .github_app import GitHubAppAdapter, ProvisioningDenied as GitHubDenied
from .cloudflare import CloudflareTokenAdapter, ProvisioningDenied as CloudflareDenied

class ProvisioningEngine:
    """Routes only explicit credential-creation requests to a registered adapter.

    The caller must construct the request from a trusted capability catalog and
    provide a signed approval. This dispatcher never accepts arbitrary provider
    URLs, permissions inferred from untrusted text, or a raw credential output.
    """
    def __init__(self, *, github: GitHubAppAdapter | None = None,
                 cloudflare: CloudflareTokenAdapter | None = None):
        self._providers = {"github": github, "cloudflare": cloudflare}

    def provision(self, *, request: Request, approval: Approval,
                  options: Mapping[str, Any]) -> Mapping[str, Any]:
        if request.action is not Action.CREATE_CREDENTIAL:
            raise ValueError("only_explicit_credential_creation_is_supported")
        adapter = self._providers.get(request.provider)
        if adapter is None:
            raise ValueError("unsupported_provider")
        if adapter is None or (request.environment == "production"):
            raise ValueError("provider_or_environment_not_enabled")
        try:
            if request.provider == "github":
                allowed = {"permissions", "repository_ids"}
                if set(options) != allowed:
                    raise ValueError("github_options_must_be_exact")
                result = adapter.issue_token(request=request, approval=approval,
                    permissions=options["permissions"], repository_ids=options["repository_ids"])
                return {"provider": result.provider, "handle": result.handle,
                        "expires_at": result.expires_at, "permissions": dict(result.permissions),
                        "resource_scope": result.resource_scope}
            if request.provider == "cloudflare":
                allowed = {"token_name", "permission_group_ids", "resource_key", "ttl_minutes"}
                if set(options) != allowed:
                    raise ValueError("cloudflare_options_must_be_exact")
                return adapter.issue_token(request=request, approval=approval,
                    token_name=options["token_name"], permission_group_ids=options["permission_group_ids"],
                    resource_key=options["resource_key"], ttl_minutes=options["ttl_minutes"])
        except (GitHubDenied, CloudflareDenied):
            # Provider adapters already return redacted, non-secret error codes.
            raise
        raise ValueError("unsupported_provider")
