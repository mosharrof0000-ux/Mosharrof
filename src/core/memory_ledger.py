import time
from typing import Any, Dict, List

class MemoryLedger:
    """Append-oriented short-term ledger plus explicit long-term knowledge."""
    def __init__(self):
        self.short_term_memory: List[Dict[str, Any]] = []
        self.long_term_memory: Dict[str, Any] = {}

    def record_event(self, event_type: str, payload: Dict[str, Any]):
        self.short_term_memory.append({"timestamp":time.time(),"event_type":event_type,"payload":payload})

    def consolidate_knowledge(self, key: str, data: Any):
        self.long_term_memory[key] = data

    def recall_recent_events(self, limit: int = 5) -> List[Dict[str, Any]]:
        return self.short_term_memory[-max(0, limit):]
