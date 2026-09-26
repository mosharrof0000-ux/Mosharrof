from dataclasses import dataclass, asdict
from datetime import datetime, timezone

@dataclass
class AuditEvent:
    entity_id: str
    action: str
    result: str
    timestamp: str
    details: object = None

class AuditLog:
    def __init__(self):
        self.events = []

    def record(self, entity_id: str, action: str, result: str, details=None):
        event = AuditEvent(entity_id, action, result, datetime.now(timezone.utc).isoformat(), details)
        self.events.append(asdict(event))
        return self.events[-1]
