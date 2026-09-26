"""Mosharrof memory ledger with explicit audit-friendly records."""
from typing import Dict, Any, List
import time

class MemoryLedger:
    def __init__(self):
        self.short_term_memory: List[Dict[str, Any]] = []
        self.long_term_memory: Dict[str, Any] = {}

    def record_event(self, event_type: str, payload: Dict[str, Any]):
        entry = {"timestamp": time.time(), "event_type": event_type, "payload": payload}
        self.short_term_memory.append(entry)
        return entry

    def consolidate_knowledge(self, key: str, data: Any):
        self.long_term_memory[key] = data

    def recall_recent_events(self, limit: int = 5) -> List[Dict[str, Any]]:
        return self.short_term_memory[-max(0, limit):]
