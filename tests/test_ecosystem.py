"""Core safety and integration tests for Mosharrof."""
from src.core.entity_registry import EntityRegistry
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.permission_guard import PermissionGuard

def test_core_brain_activation_and_routing():
    brain = MosharrofCoreBrain(event_bus=EcosystemEventBus(), memory_ledger=MemoryLedger())
    result = brain.process_intent("Please organize the files and folders")
    assert result["status"] == "SUCCESS"
    assert result["route"] == "storage"
    assert brain.system_status()["state"] == "ACTIVE"

def test_delete_is_always_blocked():
    guard = PermissionGuard()
    assert guard.check("DELETE")["status"] == "DENIED"
    assert guard.check("WRITE", destructive=True)["status"] == "DENIED"

def test_entity_registry_isolated():
    registry = EntityRegistry()
    registry.register("chat", responsibility="Conversation and user interaction",
                      brain="chat-brain", permissions=["READ", "RESPOND"])
    assert registry.get("chat")["permissions"] == ["READ", "RESPOND"]
