"""Focused unit/integration tests for the Mosharrof foundation."""
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine

def test_core_brain_and_memory():
    bus, ledger = EcosystemEventBus(), MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=bus, memory_ledger=ledger)
    result = brain.process_intent("organize project")
    assert result["status"] == "SUCCESS"
    assert result["intent_clarity"] == "100%"
    assert ledger.recall_recent_events(1)[0]["event_type"] == "INTENT_RECEIVED"

def test_event_bus():
    bus = EcosystemEventBus()
    received = []
    bus.subscribe("SYSTEM_ALERT", received.append)
    bus.publish("SYSTEM_ALERT", {"ok": True})
    assert received == [{"ok": True}]

def test_voice_engine_is_explicitly_toggleable():
    voice = VoiceJournalEngine()
    assert voice.toggle_listening(False)["listening_state"] == "INACTIVE"
    assert voice.toggle_listening(True)["listening_state"] == "ACTIVE"

def test_storage_scan_is_non_destructive():
    result = StorageEngine(root_dir=".").scan_and_index_storage(".")
    assert result["status"] == "SUCCESS"

def test_tool_factory_registry():
    assert isinstance(ToolFactory().list_available_tools(), list)

def test_delete_policy_is_hard_block():
    brain = MosharrofCoreBrain()
    assert brain.system_status()["delete_allowed"] is False
