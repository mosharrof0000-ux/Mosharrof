from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.permissions import PermissionGate
from src.core.registry import EntityRegistry

def test_core_boot_and_intent():
    bus = EcosystemEventBus()
    memory = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=bus, memory_ledger=memory)
    result = brain.process_intent("organize the project")
    assert result["status"] == "SUCCESS"
    assert memory.recall_recent_events(1)[0]["event_type"] == "INTENT_RECEIVED"

def test_delete_is_permanently_blocked():
    gate = PermissionGate({"READ", "CREATE", "UPDATE", "EXECUTE"})
    assert gate.check("DELETE").allowed is False
    assert gate.check("DESTRUCTIVE").allowed is False

def test_registry_loads():
    registry = EntityRegistry()
    registry.load()
    assert registry.get("mosharrof.core").name == "Mosharrof Core"

def test_event_bus():
    bus = EcosystemEventBus()
    received = []
    bus.subscribe("SYSTEM_ALERT", received.append)
    bus.publish("SYSTEM_ALERT", {"ok": True})
    assert received == [{"ok": True}]
