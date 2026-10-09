"""Trusted-context facade for the universal permission engine.

Requesters provide only the requested action and target resource. Grants,
entity scope, policy decisions, provider readiness, and approval are resolved
by server-owned callbacks; caller-supplied booleans or grant lists are never
accepted by this API. Missing or failing resolvers deny authorization.
"""
from __future__ import annotations

from typing import Callable, Iterable, Any

from src.core.universal_permission_engine import UniversalPermissionEngine


GrantResolver = Callable[[str], Iterable[str]]
ScopeResolver = Callable[[str], str]
PolicyEvaluator = Callable[[str, str, str, str], bool]
ProviderReadiness = Callable[[str], bool]
ApprovalVerifier = Callable[[str, str, Any], bool]


class TrustedPermissionService:
    """Resolve authorization context from trusted application-owned sources.

    The default configuration intentionally cannot authorize actions. Production
    callers must wire resolvers to trusted grant, entity, policy, provider and
    approval stores before using this service to execute any operation.
    """

    def __init__(
        self,
        *,
        engine: UniversalPermissionEngine | None = None,
        grant_resolver: GrantResolver | None = None,
        scope_resolver: ScopeResolver | None = None,
        policy_evaluator: PolicyEvaluator | None = None,
        provider_readiness: ProviderReadiness | None = None,
        approval_verifier: ApprovalVerifier | None = None,
    ) -> None:
        self.engine = engine or UniversalPermissionEngine()
        self.grant_resolver = grant_resolver
        self.scope_resolver = scope_resolver
        self.policy_evaluator = policy_evaluator
        self.provider_readiness = provider_readiness
        self.approval_verifier = approval_verifier

    def authorize(
        self,
        capability: str,
        *,
        entity_id: str,
        resource_scope: str,
        approval_token: Any = None,
        destructive: bool = False,
    ) -> dict[str, Any]:
        """Authorize using trusted context only; resolver errors fail closed."""
        entity = (entity_id or "").strip()
        resource = (resource_scope or "").strip()

        if not entity or not resource:
            return self.engine.authorize(
                capability,
                entity_id=entity,
                resource_scope=resource,
                entity_scope="",
                policy_ok=False,
                destructive=destructive,
            )

        try:
            grants = tuple(self.grant_resolver(entity)) if self.grant_resolver else ()
        except Exception:
            grants = ()

        try:
            entity_scope = self.scope_resolver(entity) if self.scope_resolver else ""
        except Exception:
            entity_scope = ""

        try:
            policy_ok = bool(
                self.policy_evaluator(capability, entity, resource, entity_scope)
            ) if self.policy_evaluator else False
        except Exception:
            policy_ok = False

        try:
            provider_ready = bool(self.provider_readiness(capability)) if self.provider_readiness else False
        except Exception:
            provider_ready = False

        try:
            user_approved = bool(
                self.approval_verifier(capability, entity, approval_token)
            ) if self.approval_verifier else False
        except Exception:
            user_approved = False

        return self.engine.authorize(
            capability,
            entity_id=entity,
            granted_permissions=grants,
            resource_scope=resource,
            entity_scope=entity_scope or "",
            policy_ok=policy_ok,
            provider_ready=provider_ready,
            user_approved=user_approved,
            destructive=destructive,
        )
