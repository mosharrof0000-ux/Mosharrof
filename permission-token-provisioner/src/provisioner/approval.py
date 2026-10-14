"""HMAC-authenticated approvals with atomic replay protection.

The signing key belongs only to an authenticated owner-approval backend.
Never expose it to browser code or the MOSHARROF client. SQLite storage is
suitable for isolated staging/single-instance use on persistent storage; use a
shared transactional database before multi-instance or production deployment.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .policy import Approval, Request

def approval_payload(approval: Approval) -> bytes:
    payload = {
        "approval_id": approval.approval_id,
        "provider": approval.provider,
        "action": approval.action.value,
        "permission_set": sorted(approval.permission_set),
        "resource_scope": approval.resource_scope,
        "environment": approval.environment,
        "capability": approval.capability,
        "expires_at": approval.expires_at.astimezone(timezone.utc).isoformat(),
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def sign_approval(approval: Approval, secret: bytes) -> str:
    """Called only by the authenticated owner-approval backend."""
    if len(secret) < 32:
        raise ValueError("approval signing secret must be at least 32 bytes")
    return hmac.new(secret, approval_payload(approval), hashlib.sha256).hexdigest()

class HmacSQLiteApprovalService:
    def __init__(self, *, secret: bytes, database_path: str, clock: Callable[[], datetime] | None = None):
        if len(secret) < 32:
            raise ValueError("approval signing secret must be at least 32 bytes")
        if not database_path:
            raise ValueError("persistent database path is required")
        self._secret = secret
        self._database_path = str(Path(database_path))
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        with sqlite3.connect(self._database_path) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""CREATE TABLE IF NOT EXISTS consumed_approvals (
                approval_id TEXT PRIMARY KEY,
                consumed_at TEXT NOT NULL
            )""")

    def authorize_and_consume(self, request: Request, approval: Approval) -> bool:
        if not approval.approval_id or not approval.signature:
            return False
        expected_signature = sign_approval(approval, self._secret)
        if not hmac.compare_digest(expected_signature, approval.signature):
            return False
        expected_scope = (request.provider, request.action, request.permission_set,
                          request.resource_scope, request.environment, request.capability)
        actual_scope = (approval.provider, approval.action, approval.permission_set,
                        approval.resource_scope, approval.environment, approval.capability)
        if actual_scope != expected_scope:
            return False
        if approval.expires_at.tzinfo is None or approval.expires_at <= self._clock():
            return False
        try:
            with sqlite3.connect(self._database_path, timeout=10, isolation_level=None) as db:
                db.execute("BEGIN IMMEDIATE")
                db.execute("INSERT INTO consumed_approvals(approval_id, consumed_at) VALUES (?, ?)",
                           (approval.approval_id, self._clock().astimezone(timezone.utc).isoformat()))
                db.execute("COMMIT")
            return True
        except sqlite3.IntegrityError:
            return False
        except sqlite3.Error:
            try:
                db.execute("ROLLBACK")
            except Exception:
                pass
            return False
