"""Append-only audit records for entity actions and policy decisions."""
from datetime import datetime, timezone
from typing import Any, Dict, List


class AuditLedger:
    def __init__(self):
        self.records: List[Dict[str, Any]] = []

    def record(self, entity_id: str, action: str, status: str, **details: Any) -> Dict[str, Any]:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "entity_id": entity_id,
            "action": action,
            "status": status,
            "details": details,
        }
        self.records.append(entry)
        return entry

    def recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.records[-limit:]
