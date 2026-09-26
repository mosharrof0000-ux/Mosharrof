import pytest
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine

def test_core_brain_contract():
    bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=bus, memory_ledger=ledger)
    assert brain.consciousness_state == "SUPREME_GOVERNANCE"
    assert brain.process_intent("test")["status"] == "SUCCESS"
    assert brain.monitor_sub_agent("x", {"status": "PROCESSING", "operation": "WRITE"})["decision"] == "APPROVED"
    assert brain.monitor_sub_agent("x", {"status": "PROCESSING", "operation": "DELETE"})["decision"] == "REJECTED"

def test_event_memory_voice_storage_and_tools(tmp_path):
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    received = []
    event_bus.subscribe("SYSTEM_ALERT", received.append)
    event_bus.publish("SYSTEM_ALERT", {"ok": True})
    assert received == [{"ok": True}]

    voice = VoiceJournalEngine(memory_ledger=ledger)
    assert voice.toggle_listening(True)["listening_state"] == "ACTIVE"
    assert voice.process_ambient_conversation("TEST_SPEAKER", "hello")["status"] == "SUCCESS"
    assert ledger.recall_recent_events(2)

    storage = StorageEngine(root_dir=str(tmp_path))
    (tmp_path / "example.txt").write_text("ok", encoding="utf-8")
    assert storage.scan_and_index_storage()["total_files_scanned"] == 1
    assert "example.txt" in storage.search_file("example")

    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    assert isinstance(factory.list_available_tools(), list)
