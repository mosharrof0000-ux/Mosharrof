"""Tests for the current Mosharrof foundation contract."""

from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine


def test_core_brain_activation_and_intent():
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)

    assert brain.consciousness_state == "FOUNDATION_ACTIVE"
    result = brain.process_intent("organize my files")
    assert result["status"] == "SUCCESS"
    assert result["intent"] == "storage_request"
    assert ledger.recall_recent_events(1)[0]["event_type"] == "INTENT_PROCESSED"


def test_event_bus_and_memory():
    bus = EcosystemEventBus()
    received = []
    bus.subscribe("SYSTEM_ALERT", received.append)
    bus.publish("SYSTEM_ALERT", {"ok": True})
    assert received == [{"ok": True}]

    ledger = MemoryLedger()
    ledger.record_event("BOOT", {"status": "SUCCESS"})
    ledger.consolidate_knowledge("SYSTEM_VERSION", "1.0.0")
    assert ledger.long_term_memory["SYSTEM_VERSION"] == "1.0.0"


def test_voice_engine_uses_shared_memory():
    ledger = MemoryLedger()
    voice = VoiceJournalEngine(memory_ledger=ledger)
    assert voice.toggle_listening(True)["listening_state"] == "ACTIVE"
    result = voice.process_ambient_conversation(
        "SPEAKER_TEST_01", "Test transcript"
    )
    assert result["status"] == "SUCCESS"
    assert ledger.recall_recent_events(1)[0]["event_type"] == "SOCIAL_INTERACTION_LOGGED"


def test_storage_engine_scans_a_controlled_directory(tmp_path):
    sample = tmp_path / "sample.txt"
    sample.write_text("hello", encoding="utf-8")
    result = StorageEngine().scan_and_index_storage(str(tmp_path))
    assert result["status"] == "SUCCESS"
    assert result["total_files_scanned"] == 1


def test_tool_factory_starts_with_a_valid_registry(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    assert isinstance(factory.list_available_tools(), list)
