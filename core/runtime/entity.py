from dataclasses import dataclass, field
from .audit import AuditLog
from .brain import BrainAdapter
from .permission import PermissionGate

@dataclass
class Entity:
    entity_id: str
    responsibility: str
    brain: BrainAdapter
    permissions: PermissionGate
    audit: AuditLog
    state: dict = field(default_factory=dict)

    def understand(self, input_text: str) -> dict:
        result = self.brain.understand(input_text, self.state)
        self.audit.record(self.entity_id, "UNDERSTAND", "SUCCESS")
        return result

    def authorize(self, operation: str) -> bool:
        decision = self.permissions.check(operation)
        self.audit.record(self.entity_id, operation, decision.reason)
        return decision.allowed
