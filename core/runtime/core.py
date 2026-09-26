from .audit import AuditLog
from .brain import DeterministicBrain
from .entity import Entity
from .permission import PermissionGate

class MosharrofCore:
    def __init__(self):
        self.audit = AuditLog()
        self.entity = Entity(
            entity_id="mosharrof.core",
            responsibility="coordinate the ecosystem within explicit policy boundaries",
            brain=DeterministicBrain(),
            permissions=PermissionGate({"READ","WRITE","CREATE","UPDATE","EXECUTE"}),
            audit=self.audit,
        )

    def status(self):
        return {
            "project":"Mosharrof",
            "entity":self.entity.entity_id,
            "delete_allowed":self.entity.authorize("DELETE"),
            "write_allowed":self.entity.authorize("WRITE")
        }
