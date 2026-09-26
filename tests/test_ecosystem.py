"""Mosharrof foundation integration tests."""
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine

def test_core_accepts_shared_memory():
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)
    result = brain.process_intent("organize the project")
    assert result["status"] == "SUCCESS"
    assert result["policy_checked"] is True
    assert ledger.recall_recent_events(1)[0]["event_type"] == "INTENT_PROCESSED"

def test_ecosystem_components_construct():
    ledger = MemoryLedger()
    assert isinstance(ToolFactory().list_available_tools(), list)
    assert VoiceJournalEngine(memory_ledger=ledger).toggle_listening(False)["listening_state"] == "INACTIVE"
    assert StorageEngine().scan_and_index_storage(".")["status"] == "SUCCESS"
