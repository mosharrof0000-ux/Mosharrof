from core.runtime.core import MosharrofCore
from core.runtime.audit import AuditLog
from core.runtime.brain import DeterministicBrain
from core.runtime.entity import Entity
from core.runtime.permission import PermissionGate

def test_delete_is_permanently_denied():
    assert MosharrofCore().entity.authorize("DELETE") is False

def test_granted_write_is_allowed():
    assert MosharrofCore().entity.authorize("WRITE") is True

def test_entity_has_independent_brain_and_identity():
    entity = Entity("test.entity","test only",DeterministicBrain(),PermissionGate({"READ"}),AuditLog())
    result = entity.understand("hello")
    assert result["status"] == "UNDERSTOOD"
    assert entity.entity_id == "test.entity"
    assert entity.audit.events
