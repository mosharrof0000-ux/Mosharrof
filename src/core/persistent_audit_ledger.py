"""Durable append-only audit ledger with sensitive-detail allowlisting."""
from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


class SQLiteAuditLedger:
    """Durable, append-only audit ledger for runtime use.

    Only a small allow-list of non-sensitive metadata is persisted. Caller
    supplied tokens, raw scopes, arguments, operation results and exception
    text are intentionally dropped even if accidentally passed as details.
    UPDATE and DELETE are blocked at the SQLite layer.
    """

    _ALLOWED_DETAILS = {
        "event_id", "action_id", "reason", "started_at", "scope_present",
        "risk", "approval_id", "duration_ms",
    }

    def __init__(self, database_path: str | Path = "data/audit/device-actions.sqlite3"):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as connection, connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_events (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    status TEXT NOT NULL,
                    details_json TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """CREATE TRIGGER IF NOT EXISTS audit_events_no_update
                   BEFORE UPDATE ON audit_events
                   BEGIN SELECT RAISE(ABORT, 'audit ledger is append-only'); END"""
            )
            connection.execute(
                """CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
                   BEFORE DELETE ON audit_events
                   BEGIN SELECT RAISE(ABORT, 'audit ledger is append-only'); END"""
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.database_path), timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    def record(self, entity_id: str, action: str, status: str, **details: Any) -> Dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        safe_details = {
            key: value for key, value in details.items()
            if key in self._ALLOWED_DETAILS and isinstance(value, (str, int, float, bool, type(None)))
        }
        # The broker supplies an event timestamp; retain it when valid.
        timestamp = details.get("timestamp")
        if isinstance(timestamp, str) and timestamp:
            now = timestamp
        with closing(self._connect()) as connection, connection:
            cursor = connection.execute(
                "INSERT INTO audit_events(timestamp, entity_id, action, status, details_json) "
                "VALUES (?, ?, ?, ?, ?)",
                (now, str(entity_id or "")[:160], str(action or "")[:160],
                 str(status or "UNKNOWN")[:80],
                 json.dumps(safe_details, ensure_ascii=False, separators=(",", ":"))),
            )
            sequence = cursor.lastrowid
        return {
            "sequence": sequence, "timestamp": now, "entity_id": str(entity_id or "")[:160],
            "action": str(action or "")[:160], "status": str(status or "UNKNOWN")[:80],
            "details": safe_details,
        }

    def recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        limit = max(0, min(int(limit), 1000))
        if limit == 0:
            return []
        with closing(self._connect()) as connection, connection:
            rows = connection.execute(
                "SELECT sequence, timestamp, entity_id, action, status, details_json "
                "FROM audit_events ORDER BY sequence DESC LIMIT ?", (limit,)
            ).fetchall()
        return [
            {"sequence": row["sequence"], "timestamp": row["timestamp"],
             "entity_id": row["entity_id"], "action": row["action"],
             "status": row["status"], "details": json.loads(row["details_json"])}
            for row in reversed(rows)
        ]
