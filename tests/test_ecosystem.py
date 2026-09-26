import pytest
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine

def test_core_accepts_shared_memory():
    bus, ledger = EcosystemEventBus(), MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=bus, memory_ledger=ledger)
    result = brain.process_intent("গল্প ও ফাইল গুছিয়ে রাখো")
    assert result["status"] == "SUCCESS"
    assert result["intent_clarity"] == "100%"
    assert ledger.recall_recent_events(1)[0]["event_type"] == "INTENT_PROCESSED"

def test_delete_policy_is_hard_block():
    result = MosharrofCoreBrain().monitor_sub_agent(
        "test_entity", {"status": "PROCESSING", "operation": "DELETE"})
    assert result["decision"] == "REJECTED"
    assert result["reason"] == "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"

def test_event_bus():
    bus, received = EcosystemEventBus(), []
    bus.subscribe("SYSTEM_ALERT", received.append)
    bus.publish("SYSTEM_ALERT", {"ok": True})
    assert received == [{"ok": True}]

def test_memory_ledger():
    ledger = MemoryLedger()
    ledger.record_event("BOOT", {"status": "SUCCESS"})
    assert ledger.recall_recent_events(1)[0]["payload"]["status"] == "SUCCESS"

def test_tool_factory():
    assert isinstance(ToolFactory().list_available_tools(), list)

def test_voice_engine():
    engine = VoiceJournalEngine(memory_ledger=MemoryLedger())
    assert engine.toggle_listening(True)["listening_state"] == "ACTIVE"
    assert engine.process_ambient_conversation("TEST_VOICE", "test transcript")["status"] == "SUCCESS"
