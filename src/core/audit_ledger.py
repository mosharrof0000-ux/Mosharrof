"""Append-only audit records for writes, permission changes, and decisions."""

import time


class AuditLedger:
    def __init__(self):
        self.records = []

    def record(self, actor: str, action: str, result: str, details=None):
        self.records.append({
            "timestamp": time.time(),
            "actor": actor,
            "action": action,
            "result": result,
            "details": details or {}
        })

    def recent(self, limit: int = 20):
        return self.records[-limit:]
