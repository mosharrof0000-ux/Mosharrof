"""
Mosharrof Core integration tests.

Tests are deterministic and isolated from the real repository filesystem.
"""

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

    voice_toggle = voice_engine.toggle_listening(True)
    assert voice_toggle["listening_state"] == "ACTIVE"

    voice_res = voice_engine.process_ambient_conversation(
        "SPEAKER_SHAMIM_01", "আজকের মিটিংয়ের সিদ্ধান্ত কী?"
    )
    assert voice_res["status"] == "SUCCESS"

    sample = tmp_path / "sample.txt"
    sample.write_text("hello", encoding="utf-8")
    scan_res = storage_engine.scan_and_index_storage(str(tmp_path))
    assert scan_res["status"] == "SUCCESS"
    assert scan_res["total_files_scanned"] >= 1

    available_tools = tool_factory.list_available_tools()
    assert isinstance(available_tools, list)

    brain_res = brain.process_intent("আমাদের ফাইল গুছিয়ে রাখো")
    assert brain_res["status"] == "SUCCESS"
    assert brain_res["intent"] == "ORGANIZE_STORAGE"
    assert 0.0 < brain_res["intent_clarity"] <= 1.0


def test_tool_factory_blocks_destructive_code(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    result = factory.create_tool(
        "unsafe",
        "import os\nos.remove('important.txt')\nreturn 'done'",
    )
    assert result == "DENIED: DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"
    assert "unsafe" not in factory.list_available_tools()
