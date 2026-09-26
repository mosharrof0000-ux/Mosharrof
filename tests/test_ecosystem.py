"""Core ecosystem integration tests."""

from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine


def test_full_ecosystem_flow(tmp_path):
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)
    tool_factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    voice_engine = VoiceJournalEngine(memory_ledger=ledger)
    storage_engine = StorageEngine()

    assert voice_engine.toggle_listening(True)["listening_state"] == "ACTIVE"
    assert voice_engine.process_ambient_conversation(
        "TEST_SPEAKER", "Test conversation"
    )["status"] == "SUCCESS"

    scan_res = storage_engine.scan_and_index_storage(str(tmp_path))
    assert scan_res["status"] == "SUCCESS"

    assert isinstance(tool_factory.list_available_tools(), list)

    brain_res = brain.process_intent("Organize the project")
    assert brain_res["status"] == "SUCCESS"
    assert brain_res["intent_clarity"] == "100%"
    assert brain_res["execution"] == "REQUIRES_POLICY_AND_PERMISSION"
