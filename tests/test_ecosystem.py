"""Integration and safety tests for the Mosharrof core foundation."""
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

    assert brain.system_status()["delete_operations"] == "BLOCKED"
    assert voice_engine.toggle_listening(True)["listening_state"] == "ACTIVE"
    assert voice_engine.process_ambient_conversation(
        "SPEAKER_TEST_01", "Test conversation"
    )["status"] == "SUCCESS"

    sample = tmp_path / "sample.txt"
    sample.write_text("test", encoding="utf-8")
    scan = storage_engine.scan_and_index_storage(str(tmp_path))
    assert scan["status"] == "SUCCESS"
    assert scan["total_files_scanned"] >= 1
    assert isinstance(tool_factory.list_available_tools(), list)

    intent = brain.process_intent("গবেষণার জন্য কুরআন ফাইল খুঁজে দাও")
    assert intent["status"] == "SUCCESS"
    assert intent["intent"] == "RESEARCH"
    assert intent["intent_clarity"] == 1.0


def test_capability_boundary():
    brain = MosharrofCoreBrain()
    assert brain.authorize_action(entity_id="core", operation="READ", scope="core")["status"] == "ALLOWED"
    assert brain.authorize_action(entity_id="core", operation="DELETE", scope="core")["status"] == "DENIED"
    assert brain.authorize_action(entity_id="core", operation="DESTRUCTIVE", scope="core")["status"] == "DENIED"
    assert brain.authorize_action(entity_id="chat", operation="WRITE", scope="chat")["status"] == "DENIED"
    assert brain.authorize_action(entity_id="chat", operation="MESSAGE", scope="chat")["status"] == "ALLOWED"


def test_delete_is_permanently_blocked():
    result = MosharrofCoreBrain().monitor_sub_agent(
        "chat", {"status": "PROCESSING", "operation": "DELETE", "scope": "chat"}
    )
    assert result["decision"] == "REJECTED"
    assert result["integrity_check"] == "FAILED"


def test_storage_organization_is_explicitly_authorized(tmp_path):
    folder = tmp_path / "files"
    folder.mkdir()
    (folder / "note.txt").write_text("x", encoding="utf-8")
    storage = StorageEngine(root_dir=str(tmp_path))
    result = storage.auto_organize_folder(str(folder))
    assert result["status"] == "SUCCESS"
    assert (folder / "Documents" / "note.txt").exists()


def test_tool_factory_blocks_destructive_source(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    result = factory.create_tool("bad_tool", "import os\nos.remove('x')")
    assert result.startswith("DENIED:")


def test_runtime_import_smoke():
    import src.main
    assert callable(src.main.boot_mosharrof_ai)
