"""Cloudflare user-token provisioning adapter.

Requires an owner-authorized bootstrap API token with API Tokens Write. It
creates a narrowly scoped, expiring token only after an external approval
service authenticates and atomically consumes the exact approval. The raw
credential is sent only to the configured vault adapter.
"""
from __future__ import annotations
import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Protocol, Sequence

from .policy import Action, Approval, Decision, Request, evaluate

class ApprovalService(Protocol):
    def authorize_and_consume(self, request: Request, approval: Approval) -> bool: ...

class SecretVault(Protocol):
    def store_secret(self, *, name: str, value: str, expires_at: str, metadata: Mapping[str, str]) -> str: ...

class ProvisioningDenied(RuntimeError):
    pass

class CloudflareTokenAdapter:
    API_ROOT = "https://api.cloudflare.com/client/v4"
    GROUP_PERMISSION_PREFIX = "cf_permission_group:"
    MAX_TTL_MINUTES = 24 * 60
    GROUP_ID = re.compile(r"^[a-f0-9]{32}$")
    RESOURCE_KEY = re.compile(r"^com\.cloudflare\.api\.(?:account\.[A-Za-z0-9._-]+|account\.zone\.[A-Za-z0-9_-]{32}|user)$")

    def __init__(self, *, approval_service: ApprovalService, vault: SecretVault,
                 bootstrap_token: str | None = None, opener: Any = urllib.request.urlopen,
                 clock: Any = lambda: datetime.now(timezone.utc)) -> None:
        self.bootstrap_token = bootstrap_token or os.getenv("CLOUDFLARE_TOKEN_MINTING_BOOTSTRAP", "")
        self.approval_service, self.vault = approval_service, vault
        self.opener, self.clock = opener, clock

    def issue_token(self, *, request: Request, approval: Approval, token_name: str,
                    permission_group_ids: Sequence[str], resource_key: str,
                    ttl_minutes: int) -> Mapping[str, str]:
        if request.provider != "cloudflare" or request.action is not Action.CREATE_CREDENTIAL:
            raise ProvisioningDenied("request_not_for_cloudflare_credential_creation")
        if request.environment == "production":
            raise ProvisioningDenied("production_provisioning_disabled")
        if not self.bootstrap_token:
            raise ProvisioningDenied("cloudflare_token_minting_bootstrap_missing")
        if not token_name.strip() or len(token_name) > 120:
            raise ProvisioningDenied("invalid_token_name")
        if not isinstance(ttl_minutes, int) or not 1 <= ttl_minutes <= self.MAX_TTL_MINUTES:
            raise ProvisioningDenied("ttl_must_be_between_1_and_1440_minutes")
        if not permission_group_ids or any(not self.GROUP_ID.fullmatch(x) for x in permission_group_ids):
            raise ProvisioningDenied("invalid_permission_group_id")
        if len(set(permission_group_ids)) != len(permission_group_ids):
            raise ProvisioningDenied("duplicate_permission_group_id")
        if not self.RESOURCE_KEY.fullmatch(resource_key) or "*" in resource_key:
            raise ProvisioningDenied("resource_key_must_be_specific")
        canonical_permissions = frozenset(self.GROUP_PERMISSION_PREFIX + x for x in permission_group_ids)
        expected_scope = f"{resource_key}=*;ttl_minutes={ttl_minutes}"
        if canonical_permissions != request.permission_set:
            raise ProvisioningDenied("permission_group_set_does_not_match_approval")
        if request.resource_scope != expected_scope or approval.resource_scope != expected_scope:
            raise ProvisioningDenied("resource_scope_or_ttl_does_not_match_approval")
        if not self.approval_service.authorize_and_consume(request, approval):
            raise ProvisioningDenied("owner_approval_invalid_or_already_used")
        result = evaluate(request, approval=approval, approval_authentic=True)
        if result.decision is not Decision.ALLOW:
            raise ProvisioningDenied(result.reason)

        expires_on = (self.clock() + timedelta(minutes=ttl_minutes)).astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
        payload = {
            "name": token_name,
            "policies": [{
                "effect": "allow",
                "permission_groups": [{"id": group_id} for group_id in permission_group_ids],
                "resources": {resource_key: "*"},
            }],
            "expires_on": expires_on,
        }
        body = self._post_create(payload)
        if not isinstance(body, dict) or not body.get("value") or not body.get("id"):
            raise ProvisioningDenied("cloudflare_response_missing_token_value_or_id")
        returned_expiry = body.get("expires_on")
        if not returned_expiry or returned_expiry != expires_on:
            raise ProvisioningDenied("cloudflare_returned_expiry_mismatch")
        policies = body.get("policies")
        if not isinstance(policies, list) or len(policies) != 1:
            raise ProvisioningDenied("cloudflare_returned_policy_mismatch")
        policy = policies[0]
        returned_ids = sorted(p.get("id") for p in policy.get("permission_groups", []) if isinstance(p, dict))
        if (policy.get("effect") != "allow" or returned_ids != sorted(permission_group_ids)
                or policy.get("resources") != {resource_key: "*"}):
            raise ProvisioningDenied("cloudflare_returned_scope_mismatch")
        handle = self.vault.store_secret(
            name=f"cloudflare-{body['id']}", value=body["value"], expires_at=returned_expiry,
            metadata={"provider": "cloudflare", "token_id": body["id"], "token_name": token_name,
                      "resource_scope": expected_scope, "permission_group_ids": ",".join(sorted(permission_group_ids)),
                      "environment": request.environment},
        )
        if not isinstance(handle, str) or not handle:
            raise ProvisioningDenied("vault_did_not_return_opaque_handle")
        return {"provider": "cloudflare", "handle": handle, "token_id": body["id"],
                "expires_at": returned_expiry, "resource_scope": expected_scope}

    def _post_create(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        req = urllib.request.Request(
            f"{self.API_ROOT}/user/tokens", data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {self.bootstrap_token}",
                     "Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with self.opener(req, timeout=20) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise ProvisioningDenied("cloudflare_token_creation_request_failed") from exc
        if not isinstance(data, dict) or data.get("success") is not True:
            # Do not expose response bodies or authorization details in exceptions.
            raise ProvisioningDenied("cloudflare_token_creation_rejected")
        result = data.get("result")
        if not isinstance(result, dict):
            raise ProvisioningDenied("cloudflare_response_missing_result")
        return result
