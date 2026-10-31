"""Narrow adapter for the existing MOSHARROF credential router.

The host injects the already-configured router's two operations. This module
never creates credentials, reads provider secrets, or changes router settings.
Only opaque vault handles cross this boundary.
"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from .policy import Request


class RouterBridgeError(RuntimeError):
    """Raised with a stable, secret-free integration error code."""


SelectHandle = Callable[[Request], str | None]
ExecuteWithHandle = Callable[[Request, str], Mapping[str, Any]]


class ExistingRouterBridge:
    """Adapt an existing router without replacing or reconfiguring it.

    select_handle must return a vault:// reference already held by the router.
    execute_with_handle must resolve that reference inside the router's trusted
    server-side boundary; it must never return the raw credential value.
    """

    def __init__(
        self,
        *,
        select_handle: SelectHandle,
        execute_with_handle: ExecuteWithHandle,
    ) -> None:
        if not callable(select_handle) or not callable(execute_with_handle):
            raise TypeError("router_callbacks_must_be_callable")
        self._select_handle = select_handle
        self._execute_with_handle = execute_with_handle

    def select_credential(self, request: Request) -> str | None:
        try:
            handle = self._select_handle(request)
        except Exception:
            raise RouterBridgeError("router_selection_failed") from None
        if handle is None:
            return None
        if not isinstance(handle, str) or not handle.startswith("vault://"):
            raise RouterBridgeError("router_must_return_opaque_vault_handle")
        return handle

    def execute(self, request: Request, *, credential_handle: str) -> Mapping[str, Any]:
        if not isinstance(credential_handle, str) or not credential_handle.startswith("vault://"):
            raise RouterBridgeError("opaque_vault_handle_required")
        try:
            result = self._execute_with_handle(request, credential_handle)
        except Exception:
            raise RouterBridgeError("router_execution_failed") from None
        if not isinstance(result, Mapping):
            raise RouterBridgeError("router_result_must_be_mapping")
        # Fail closed if the router attempts to return a raw credential.
        forbidden = ("token", "secret", "password", "private_key", "authorization", "credential_value")
        def contains_secret(value: Any) -> bool:
            if isinstance(value, Mapping):
                return any(
                    any(part in str(key).lower() for part in forbidden) or contains_secret(item)
                    for key, item in value.items()
                )
            if isinstance(value, (list, tuple)):
                return any(contains_secret(item) for item in value)
            return False
        if contains_secret(result):
            raise RouterBridgeError("router_result_contains_secret_fields")
        return dict(result)
