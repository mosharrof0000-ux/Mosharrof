"""Minimal append-only audit event contract."""

from datetime import datetime, timezone
from typing import Any, Dict, List


class AuditLog:
    def __init__(self):
        self.events: List[Dict[str, Any]] = []

    def record(self, actor: str, action: str, result: str, **details):
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actor": actor,
            "action": action,
            "result": result,
            "details": details,
        }
        self.events.append(event)
        return event

    def recent(self, limit: int = 20):
        return self.events[-limit:]
