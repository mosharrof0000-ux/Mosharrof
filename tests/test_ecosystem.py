"""Verification of the Mosharrof Core foundation."""

from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine
from src.core.permission_guard import PermissionGuard
from src.core.entity_registry import EntityDefinition, EntityRegistry


def test_core_brain_and_memory_integration():
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)

    result = brain.process_intent("organize project files")
    assert result["status"] == "SUCCESS"
    assert result["intent_clarity"] == "100%"
    assert ledger.recall_recent_events(1)[0]["event_type"] == "INTENT_PROCESSED"


def test_event_bus():
    bus = EcosystemEventBus()
    received = []
    bus.subscribe("SYSTEM_ALERT", received.append)
    bus.publish("SYSTEM_ALERT", {"ok": True})
    assert received == [{"ok": True}]


def test_permission_guard_blocks_delete_and_destructive():
    guard = PermissionGuard()
    assert guard.check("DELETE")["status"] == "DENIED"
    assert guard.check("WRITE", destructive=True)["status"] == "DENIED"
    assert guard.check("READ")["status"] == "ALLOWED"


def test_entity_registry():
    registry = EntityRegistry()
    result = registry.register(EntityDefinition(
        entity_id="test.chat",
        name="Test Chat",
        entity_type="ui_entity",
        responsibility="Conversation",
        scope="chat",
        permission_profile="chat.standard"
    ))
    assert result["status"] == "REGISTERED"
    assert registry.get("test.chat").name == "Test Chat"


def test_voice_storage_and_tool_components():
    ledger = MemoryLedger()
    voice = VoiceJournalEngine(memory_ledger=ledger)
    assert voice.toggle_listening(True)["listening_state"] == "ACTIVE"
    assert voice.process_ambient_conversation(
        "SPEAKER_TEST", "test message"
    )["status"] == "SUCCESS"

    storage = StorageEngine()
    assert storage.scan_and_index_storage(".")["status"] == "SUCCESS"

    tools = ToolFactory()
    assert isinstance(tools.list_available_tools(), list)
