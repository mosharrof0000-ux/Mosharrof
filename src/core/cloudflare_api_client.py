"""Guarded server-side Cloudflare API client.

The caller must provide permission and resource-scope metadata from a trusted
capability mapping. This module never accepts an arbitrary host and never
retries a denied request with a broader credential.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from src.core.cloudflare_token_router import CloudflareTokenRouter, TokenResolutionError


_ALLOWED_METHODS = frozenset({"GET"})
_SAFE_PATH = re.compile(r"^/(?:accounts|zones|user|memberships|organizations)(?:/[A-Za-z0-9._~-]+)*(?:/[A-Za-z0-9._~-]+)?$")


class CloudflareAPIError(RuntimeError):
    """Safe API failure; response bodies and credentials are not exposed."""

    def __init__(self, status: int | None, code: str):
        self.status = status
        self.code = code
        super().__init__(code)


class CloudflareAPIClient:
    """Calls only the fixed Cloudflare API host after token-router authorization."""

    BASE_URL = "https://api.cloudflare.com/client/v4"

    def __init__(
        self,
        router: CloudflareTokenRouter,
        *,
        timeout_seconds: float = 15.0,
        audit: Callable[[Mapping[str, Any]], None] | None = None,
    ):
        if not 1 <= timeout_seconds <= 60:
            raise ValueError("TIMEOUT_OUT_OF_RANGE")
        self.router = router
        self.timeout_seconds = timeout_seconds
        self.audit = audit or (lambda _record: None)

    @staticmethod
    def _validate_path(path: str) -> str:
        if not isinstance(path, str) or not path.startswith("/"):
            raise CloudflareAPIError(None, "INVALID_CLOUDFLARE_PATH")
        if any(part in path for part in ("..", "//", "?", "#", "\\\\", "%")):
            raise CloudflareAPIError(None, "INVALID_CLOUDFLARE_PATH")
        if not _SAFE_PATH.fullmatch(path):
            raise CloudflareAPIError(None, "INVALID_CLOUDFLARE_PATH")
        return path

    def request(
        self,
        method: str,
        path: str,
        *,
        required_permissions: set[str],
        resource_scope: str,
        body: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        method = (method or "").upper()
        if method not in _ALLOWED_METHODS:
            raise CloudflareAPIError(None, "HTTP_METHOD_NOT_ALLOWED")
        safe_path = self._validate_path(path)
        if method in {"GET", "DELETE"} and body is not None:
            raise CloudflareAPIError(None, "BODY_NOT_ALLOWED_FOR_METHOD")

        try:
            credential = self.router.resolve(required_permissions, resource_scope)
        except TokenResolutionError as exc:
            self.audit({
                "provider": "cloudflare",
                "result": "denied_before_request",
                "error_code": str(exc),
                "requested_permissions": sorted(required_permissions),
                "resource_scope": resource_scope,
            })
            raise CloudflareAPIError(None, "CREDENTIAL_NOT_AUTHORIZED") from exc

        audit_record = credential.audit_record(required_permissions, resource_scope)
        request_body = None if body is None else json.dumps(body, separators=(",", ":")).encode("utf-8")
        request = Request(
            self.BASE_URL + safe_path,
            data=request_body,
            method=method,
            headers={
                "Authorization": f"Bearer {credential.token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "Mosharrof-Cloudflare-Token-Router/1",
            },
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                status = response.status
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    raise CloudflareAPIError(status, "CLOUDFLARE_RESPONSE_TOO_LARGE")
        except HTTPError as exc:
            audit_record.update({"result": "cloudflare_denied", "http_status": exc.code})
            self.audit(audit_record)
            if exc.code in (401, 403):
                raise CloudflareAPIError(exc.code, "CLOUDFLARE_AUTHORIZATION_DENIED") from None
            raise CloudflareAPIError(exc.code, "CLOUDFLARE_HTTP_ERROR") from None
        except URLError:
            audit_record.update({"result": "network_error"})
            self.audit(audit_record)
            raise CloudflareAPIError(None, "CLOUDFLARE_NETWORK_ERROR") from None
        except TimeoutError:
            audit_record.update({"result": "timeout"})
            self.audit(audit_record)
            raise CloudflareAPIError(None, "CLOUDFLARE_TIMEOUT") from None

        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            audit_record.update({"result": "invalid_json", "http_status": status})
            self.audit(audit_record)
            raise CloudflareAPIError(status, "CLOUDFLARE_INVALID_JSON") from None

        audit_record.update({"result": "success", "http_status": status})
        self.audit(audit_record)
        if not isinstance(payload, dict):
            raise CloudflareAPIError(status, "CLOUDFLARE_INVALID_RESPONSE")
        if payload.get("success") is False:
            raise CloudflareAPIError(status, "CLOUDFLARE_OPERATION_FAILED")
        return payload
