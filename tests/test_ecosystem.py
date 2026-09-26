"""Integration tests for the Mosharrof core foundation."""

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
    storage_engine = StorageEngine(root_dir=str(tmp_path))

    assert brain.system_status()["security_protocol"] == "NO_DELETE"

    voice_toggle = voice_engine.toggle_listening(True)
    assert voice_toggle["listening_state"] == "ACTIVE"

    voice_res = voice_engine.process_ambient_conversation(
        "SPEAKER_TEST_01", "Test conversation"
    )
    assert voice_res["status"] == "SUCCESS"

    sample = tmp_path / "sample.txt"
    sample.write_text("test", encoding="utf-8")
    scan_res = storage_engine.scan_and_index_storage(str(tmp_path))
    assert scan_res["status"] == "SUCCESS"
    assert scan_res["total_files_scanned"] >= 1

    available_tools = tool_factory.list_available_tools()
    assert isinstance(available_tools, list)

    brain_res = brain.process_intent("Please organize my files")
    assert brain_res["status"] == "SUCCESS"
    assert brain_res["intent"] == "STORAGE"
    assert brain_res["intent_clarity"] == 1.0
