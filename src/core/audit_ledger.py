"""Append-only audit records for capability and lifecycle decisions."""
from datetime import datetime, timezone
from typing import Any, Dict, List

class AuditLedger:
    def __init__(self) -> None:
        self._records: List[Dict[str, Any]] = []

    def record(self, event: str, *, entity_id: str, details: Dict[str, Any] | None = None) -> Dict[str, Any]:
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": event,
            "entity_id": entity_id,
            "details": details or {}
        }
        self._records.append(record)
        return record

    def records(self) -> List[Dict[str, Any]]:
        return list(self._records)
