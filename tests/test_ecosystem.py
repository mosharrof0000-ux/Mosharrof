"""Foundation integration tests for the Mosharrof ecosystem."""

from pathlib import Path

from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.storage_engine import StorageEngine
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine


def test_core_brain_contract():
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)

    result = brain.process_intent("আমাদের ফাইল গুছিয়ে রাখো")

    assert result["status"] == "SUCCESS"
    assert result["intent"] == "STORAGE_ORGANIZATION"
    assert result["requires_policy_check"] is True


def test_core_denies_destructive_operations():
    brain = MosharrofCoreBrain()
    result = brain.monitor_sub_agent(
        "example",
        {"status": "PROCESSING", "operation": "DELETE"},
    )
    assert result["decision"] == "REJECTED"


def test_event_bus_and_memory():
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    received = []

    event_bus.subscribe("SYSTEM_ALERT", received.append)
    event_bus.publish("SYSTEM_ALERT", {"message": "ok"})
    ledger.record_event("TEST_EVENT", {"status": "ok"})

    assert received == [{"message": "ok"}]
    assert ledger.recall_recent_events(1)[0]["event_type"] == "TEST_EVENT"


def test_voice_engine_records_transcript():
    ledger = MemoryLedger()
    voice_engine = VoiceJournalEngine(memory_ledger=ledger)

    assert voice_engine.toggle_listening(True)["listening_state"] == "ACTIVE"
    result = voice_engine.process_ambient_conversation(
        "SPEAKER_TEST", "আজকের মিটিংয়ের সিদ্ধান্ত কী?"
    )

    assert result["status"] == "SUCCESS"
    assert ledger.recall_recent_events(1)[0]["event_type"] == "SOCIAL_INTERACTION_LOGGED"


def test_storage_scan_uses_explicit_test_directory(tmp_path: Path):
    (tmp_path / "sample.txt").write_text("hello", encoding="utf-8")
    engine = StorageEngine(root_dir=str(tmp_path))

    result = engine.scan_and_index_storage()

    assert result["status"] == "SUCCESS"
    assert result["total_files_scanned"] == 1


def test_tool_factory_starts_empty_or_with_registered_tools(tmp_path: Path):
    factory = ToolFactory(tools_dir=str(tmp_path))
    assert isinstance(factory.list_available_tools(), list)
