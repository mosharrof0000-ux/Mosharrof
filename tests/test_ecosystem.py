"""Integration tests for the Mosharrof foundation."""
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine

def test_full_ecosystem_flow(tmp_path):
    event_bus=EcosystemEventBus(); ledger=MemoryLedger(); brain=MosharrofCoreBrain(event_bus=event_bus,memory_ledger=ledger)
    tool_factory=ToolFactory(tools_dir=str(tmp_path/"tools")); voice_engine=VoiceJournalEngine(memory_ledger=ledger); storage_engine=StorageEngine(root_dir=str(tmp_path))
    assert voice_engine.toggle_listening(True)["listening_state"]=="ACTIVE"
    assert voice_engine.process_ambient_conversation("TEST_SPEAKER","test message")["status"]=="SUCCESS"
    assert storage_engine.scan_and_index_storage()["status"]=="SUCCESS"
    assert isinstance(tool_factory.list_available_tools(),list)
    result=brain.process_intent("organize the project"); assert result["status"]=="SUCCESS" and result["intent_clarity"]=="PARSED"
    assert ledger.recall_recent_events()

def test_delete_is_blocked_by_core():
    result=MosharrofCoreBrain().monitor_sub_agent("test",{"status":"PROCESSING","operation":"DELETE"})
    assert result["decision"]=="REJECTED"
