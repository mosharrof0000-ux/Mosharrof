"""Append-only in-memory audit ledger for core decisions and permission events."""

import time
from typing import Any, Dict, List


class AuditLedger:
    def __init__(self):
        self.records: List[Dict[str, Any]] = []

    def record(self, actor: str, action: str, result: str, details=None):
        self.records.append({
            "timestamp": time.time(),
            "actor": actor,
            "action": action,
            "result": result,
            "details": details or {},
        })

    def recent(self, limit: int = 20):
        return self.records[-limit:]
