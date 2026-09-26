"""Deterministic foundation integration tests."""

from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine


def test_core_brain_activation_and_intent():
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)

    assert brain.consciousness_state == "ACTIVE"
    result = brain.process_intent("organize the project")
    assert result["status"] == "SUCCESS"
    assert result["intent_clarity"] == "100%"


def test_event_bus_and_memory():
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    received = []

    event_bus.subscribe("SYSTEM_ALERT", received.append)
    event_bus.publish("SYSTEM_ALERT", {"msg": "ALL_SYSTEMS_GO"})
    ledger.record_event("SYSTEM_ALERT", {"msg": "ALL_SYSTEMS_GO"})

    assert received == [{"msg": "ALL_SYSTEMS_GO"}]
    assert ledger.recall_recent_events(1)[0]["event_type"] == "SYSTEM_ALERT"


def test_voice_requires_explicit_authorization():
    ledger = MemoryLedger()
    voice = VoiceJournalEngine(memory_ledger=ledger)

    assert voice.toggle_listening(True)["listening_state"] == "BLOCKED"
    assert voice.process_ambient_conversation("speaker-1", "hello")["status"] == "BLOCKED"

    assert voice.toggle_listening(True, authorized=True)["listening_state"] == "ACTIVE"
    assert voice.process_ambient_conversation("speaker-1", "hello")["status"] == "SUCCESS"


def test_tool_factory_is_loadable():
    factory = ToolFactory()
    assert isinstance(factory.list_available_tools(), list)


def test_storage_scan_is_non_destructive():
    storage = StorageEngine(".")
    result = storage.scan_and_index_storage("src")
    assert result["status"] == "SUCCESS"
    assert "delete_performed" not in result
