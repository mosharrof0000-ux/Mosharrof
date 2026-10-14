"""Redacted, hash-chained audit events for isolated staging deployments."""
from __future__ import annotations
import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

@dataclass(frozen=True)
class AuditEvent:
    actor_ref: str
    approval_ref: str
    provider: str
    capability: str
    resource_scope: str
    environment: str
    credential_id: str
    result: str
    correlation_id: str

class AuditLog:
    """Append-only-by-trigger SQLite audit log; use managed immutable storage in production."""
    _SECRETISH = re.compile(r"(?:token|secret|password|private[_ -]?key|authorization)\s*[:=]", re.I)

    def __init__(self, *, database_path: str, clock: Callable[[], datetime] | None = None):
        if not database_path:
            raise ValueError("audit_database_path_required")
        self.path = str(Path(database_path))
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        with sqlite3.connect(self.path) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""CREATE TABLE IF NOT EXISTS audit_events (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                occurred_at TEXT NOT NULL,
                actor_ref TEXT NOT NULL,
                approval_ref TEXT NOT NULL,
                provider TEXT NOT NULL,
                capability TEXT NOT NULL,
                resource_scope TEXT NOT NULL,
                environment TEXT NOT NULL,
                credential_id TEXT NOT NULL,
                result TEXT NOT NULL,
                correlation_id TEXT NOT NULL,
                previous_hash TEXT NOT NULL,
                event_hash TEXT NOT NULL UNIQUE
            )""")
            db.execute("""CREATE TRIGGER IF NOT EXISTS audit_events_no_update
                BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events_are_append_only'); END""")
            db.execute("""CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
                BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events_are_append_only'); END""")

    def append(self, event: AuditEvent) -> str:
        values = {
            "actor_ref": event.actor_ref, "approval_ref": event.approval_ref,
            "provider": event.provider, "capability": event.capability,
            "resource_scope": event.resource_scope, "environment": event.environment,
            "credential_id": event.credential_id, "result": event.result,
            "correlation_id": event.correlation_id,
        }
        if any(not isinstance(v, str) or not v.strip() for v in values.values()):
            raise ValueError("audit_fields_must_be_nonempty_strings")
        if any(self._SECRETISH.search(v) for v in values.values()):
            raise ValueError("secret_like_content_rejected_from_audit")
        occurred_at = self.clock().astimezone(timezone.utc).isoformat()
        with sqlite3.connect(self.path, timeout=10, isolation_level=None) as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1").fetchone()
            previous_hash = row[0] if row else "GENESIS"
            canonical = json.dumps({"occurred_at": occurred_at, **values,
                                    "previous_hash": previous_hash},
                                   sort_keys=True, separators=(",", ":"), ensure_ascii=False)
            event_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            db.execute("""INSERT INTO audit_events(
                occurred_at, actor_ref, approval_ref, provider, capability, resource_scope,
                environment, credential_id, result, correlation_id, previous_hash, event_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (occurred_at, values["actor_ref"], values["approval_ref"], values["provider"],
                 values["capability"], values["resource_scope"], values["environment"],
                 values["credential_id"], values["result"], values["correlation_id"],
                 previous_hash, event_hash))
            db.execute("COMMIT")
        return event_hash

    def verify_chain(self) -> bool:
        with sqlite3.connect(self.path) as db:
            rows = db.execute("""SELECT occurred_at, actor_ref, approval_ref, provider, capability,
                resource_scope, environment, credential_id, result, correlation_id, previous_hash, event_hash
                FROM audit_events ORDER BY sequence""").fetchall()
        previous_hash = "GENESIS"
        for row in rows:
            occurred_at, actor_ref, approval_ref, provider, capability, resource_scope, environment, credential_id, result, correlation_id, stored_previous, stored_hash = row
            if stored_previous != previous_hash:
                return False
            canonical = json.dumps({"occurred_at": occurred_at, "actor_ref": actor_ref,
                "approval_ref": approval_ref, "provider": provider, "capability": capability,
                "resource_scope": resource_scope, "environment": environment,
                "credential_id": credential_id, "result": result, "correlation_id": correlation_id,
                "previous_hash": stored_previous}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
            calculated = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            if calculated != stored_hash:
                return False
            previous_hash = stored_hash
        return True
