import pytest

from src.core.entity_registry import EntityRegistry
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.permission_guard import PermissionGuard

def test_core_brain_and_memory():
    bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=bus, memory_ledger=ledger)
    result = brain.process_intent("Organize the project.")
    assert result["status"] == "SUCCESS"
    assert ledger.recall_recent_events(1)[0]["event_type"] == "INTENT_RECEIVED"

def test_entity_registry():
    registry = EntityRegistry()
    ids = registry.list_ids()
    assert "mosharrof.core" in ids
    assert "mosharrof.al-quran-research" in ids

def test_delete_is_always_denied():
    guard = PermissionGuard()
    profile = {"allow":["READ","CREATE","UPDATE","DELETE"],"deny":[]}
    assert guard.authorize("DELETE", profile)["status"] == "DENIED"

def test_out_of_scope_is_denied():
    guard = PermissionGuard()
    profile = {"allow":["READ"],"deny":[]}
    assert guard.authorize("DEPLOY", profile)["status"] == "DENIED"
