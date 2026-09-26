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

    assert brain.system_status()["delete_operations"] == "BLOCKED"

    assert voice_engine.toggle_listening(True)["listening_state"] == "BLOCKED"
    assert voice_engine.toggle_listening(True, authorized=True)["listening_state"] == "ACTIVE"
    assert voice_engine.process_ambient_conversation("SPEAKER_TEST_01", "Test conversation")["status"] == "SUCCESS"

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
    assert brain.authorize_action(entity_id="chat", operation="WRITE", scope="core")["status"] == "DENIED"

def test_storage_requires_authorization_and_does_not_overwrite(tmp_path):
    storage = StorageEngine(root_dir=str(tmp_path))
    source = tmp_path / "note.txt"
    source.write_text("source", encoding="utf-8")
    assert storage.auto_organize_folder(str(tmp_path))["status"] == "BLOCKED"

    category = tmp_path / "Documents"
    category.mkdir()
    (category / "note.txt").write_text("existing", encoding="utf-8")
    result = storage.auto_organize_folder(str(tmp_path), authorized=True)
    assert result["status"] == "SUCCESS"
    assert result["moved_files"] == 0
    assert result["overwrite_performed"] is False
    assert result["conflicts"]

def test_delete_is_permanently_blocked():
    result = MosharrofCoreBrain().monitor_sub_agent(
        "chat", {"status":"PROCESSING","operation":"DELETE","scope":"chat"}
    )
    assert result["decision"] == "REJECTED"
    assert result["integrity_check"] == "FAILED"
