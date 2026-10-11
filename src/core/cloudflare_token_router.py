"""Least-privilege router for pre-provisioned Cloudflare API tokens.

This module never creates tokens and never stores secret values in the registry.
Each profile names an environment variable populated by the deployment secret store.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Any


_ENV_NAME = re.compile(r"^[A-Z][A-Z0-9_]{2,127}$")


class TokenResolutionError(RuntimeError):
    """Raised when no pre-provisioned credential safely covers a request."""


@dataclass(frozen=True)
class ResolvedCloudflareCredential:
    token_id: str
    token: str
    permissions: frozenset[str]
    resource_scopes: tuple[str, ...]

    def audit_record(self, requested_permissions: set[str], resource_scope: str) -> dict[str, Any]:
        """Return safe audit metadata. The secret is intentionally never included."""
        return {
            "provider": "cloudflare",
            "token_id": self.token_id,
            "requested_permissions": sorted(requested_permissions),
            "resource_scope": resource_scope,
            "credential_permissions": sorted(self.permissions),
            "secret_included": False,
        }


class CloudflareTokenRouter:
    """Select the narrowest configured token that covers a request.

    A registered profile is metadata only: it grants no Cloudflare permission.
    Cloudflare enforces the real permissions attached to each API token.
    """

    def __init__(self, registry_path: str | Path, environ: Mapping[str, str] | None = None):
        self.registry_path = Path(registry_path)
        self.environ = environ if environ is not None else os.environ
        document = json.loads(self.registry_path.read_text(encoding="utf-8"))
        if document.get("provider") != "cloudflare":
            raise ValueError("TOKEN_REGISTRY_PROVIDER_MUST_BE_CLOUDFLARE")
        profiles = document.get("profiles")
        if not isinstance(profiles, list):
            raise ValueError("TOKEN_REGISTRY_PROFILES_MUST_BE_A_LIST")
        self.profiles = []
        seen_ids: set[str] = set()
        for profile in profiles:
            if not isinstance(profile, dict):
                raise ValueError("TOKEN_PROFILE_MUST_BE_AN_OBJECT")
            token_id = str(profile.get("token_id", "")).strip()
            env_var = str(profile.get("secret_env", "")).strip()
            permissions = profile.get("permissions", [])
            scopes = profile.get("resource_scopes", [])
            if not token_id or token_id in seen_ids:
                raise ValueError("TOKEN_ID_MISSING_OR_DUPLICATED")
            if not _ENV_NAME.fullmatch(env_var):
                raise ValueError(f"INVALID_SECRET_ENV_NAME:{token_id}")
            if not isinstance(permissions, list) or not permissions:
                raise ValueError(f"TOKEN_PERMISSIONS_REQUIRED:{token_id}")
            if not isinstance(scopes, list) or not scopes:
                raise ValueError(f"TOKEN_RESOURCE_SCOPES_REQUIRED:{token_id}")
            if not all(isinstance(x, str) and x.strip() for x in permissions + scopes):
                raise ValueError(f"INVALID_TOKEN_PROFILE_VALUES:{token_id}")
            self.profiles.append({
                "token_id": token_id,
                "secret_env": env_var,
                "permissions": frozenset(x.strip() for x in permissions),
                "resource_scopes": tuple(x.strip().rstrip("/") for x in scopes),
                "enabled": profile.get("enabled") is True,
            })
            seen_ids.add(token_id)

    @staticmethod
    def _scope_covers(allowed_scope: str, requested_scope: str) -> bool:
        # Normalize both sides consistently; API paths commonly begin with "/".
        allowed = allowed_scope.strip().strip("/").rstrip("/")
        requested = requested_scope.strip().strip("/").rstrip("/")
        if not allowed or not requested:
            return False
        if allowed.endswith("/*"):
            prefix = allowed[:-2].rstrip("/")
            return requested == prefix or requested.startswith(prefix + "/")
        return requested == allowed or requested.startswith(allowed + "/")

    def resolve(self, required_permissions: set[str], resource_scope: str) -> ResolvedCloudflareCredential:
        required = {str(p).strip() for p in required_permissions if str(p).strip()}
        scope = (resource_scope or "").strip().strip("/")
        if not required or not scope:
            raise TokenResolutionError("PERMISSIONS_AND_RESOURCE_SCOPE_REQUIRED")

        candidates = []
        for profile in self.profiles:
            if not profile["enabled"]:
                continue
            if not required.issubset(profile["permissions"]):
                continue
            if not any(self._scope_covers(s, scope) for s in profile["resource_scopes"]):
                continue
            secret = (self.environ.get(profile["secret_env"]) or "").strip()
            if not secret:
                continue
            candidates.append((len(profile["permissions"] - required), profile["token_id"], profile, secret))

        if not candidates:
            raise TokenResolutionError("NO_ENABLED_TOKEN_COVERS_REQUEST_OR_SECRET_MISSING")

        _, _, profile, secret = sorted(candidates, key=lambda item: (item[0], item[1]))[0]
        return ResolvedCloudflareCredential(
            token_id=profile["token_id"],
            token=secret,
            permissions=profile["permissions"],
            resource_scopes=profile["resource_scopes"],
        )

    def status(self) -> list[dict[str, Any]]:
        """List readiness without returning token values or full environment values."""
        return [
            {
                "token_id": profile["token_id"],
                "enabled": profile["enabled"],
                "secret_configured": bool((self.environ.get(profile["secret_env"]) or "").strip()),
                "permissions": sorted(profile["permissions"]),
                "resource_scopes": list(profile["resource_scopes"]),
            }
            for profile in self.profiles
        ]
