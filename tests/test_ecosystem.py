"""Integration and safety tests for the Mosharrof core foundation."""
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine
from src.core.audit_ledger import AuditLedger
from src.core.temporary_permission import TemporaryPermissionManager


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
    assert callable(src.main.boot_mosharrof)
    assert src.main.boot_mosharrof_ai is src.main.boot_mosharrof

def test_storage_organizer_never_overwrites(tmp_path):
    folder = tmp_path / "files"
    folder.mkdir()
    source = folder / "note.txt"
    source.write_text("new", encoding="utf-8")
    documents = folder / "Documents"
    documents.mkdir()
    existing = documents / "note.txt"
    existing.write_text("existing", encoding="utf-8")

    result = StorageEngine().auto_organize_folder(str(folder))
    assert result["moved_files"] == 0
    assert source.exists()
    assert existing.read_text(encoding="utf-8") == "existing"


def test_tool_factory_safe_function_body_and_execution(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    assert "created and registered" in factory.create_tool("safe_tool", "return 1")
    assert factory.execute_tool("safe_tool") == 1


def test_core_audit_and_brain_adapter():
    audit = AuditLedger()
    brain = MosharrofCoreBrain(audit_ledger=audit)
    status = brain.system_status()
    assert status["brain"]["entity_id"] == "core"
    assert status["brain"]["model_independent_identity"] is True
    brain.authorize_action(entity_id="core", operation="READ", scope="core")
    assert audit.recent(1)[0]["action"] == "ACTION_ALLOWED"


def test_temporary_permission_cannot_grant_delete():
    manager = TemporaryPermissionManager()
    denied = manager.grant(
        "task-1", entity_id="core", operation="DELETE", scope="core", task="cleanup"
    )
    assert denied["status"] == "DENIED"

    granted = manager.grant(
        "task-2", entity_id="core", operation="WRITE",
        scope="core/config", task="configuration"
    )
    assert granted["status"] == "GRANTED"
    assert manager.complete_task("task-2")["status"] == "REVOKED"
    assert [r["action"] for r in manager.audit.recent()] == ["TEMP_PERMISSION_GRANT", "TEMP_PERMISSION_GRANT", "TEMP_PERMISSION_REVOKE"]


def test_machine_readable_project_contract():
    import json
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / "config/project_manifest.json").read_text(encoding="utf-8"))
    registry = json.loads((root / "config/entity_registry.json").read_text(encoding="utf-8"))
    assert manifest["owner"] == "Mosharrof Karim"
    assert manifest["immutable_safety_rules"]["delete"] is False
    assert manifest["immutable_safety_rules"]["destructive_operations"] is False
    ids = {item["id"] for item in registry["entities"]}
    assert {"core", "chat", "sidebar", "voice", "storage", "tool_factory", "quran_research"} <= ids


def test_event_bus_isolates_subscriber_failure():
    bus = EcosystemEventBus()
    received = []

    def broken(_):
        raise RuntimeError("subscriber failure")

    def healthy(data):
        received.append(data)

    bus.subscribe("TEST", broken)
    bus.subscribe("TEST", healthy)
    result = bus.publish("TEST", {"ok": True})

    assert result["status"] == "PARTIAL_FAILURE"
    assert result["delivered"] == 1
    assert len(result["failures"]) == 1
    assert received == [{"ok": True}]


def test_additional_delete_variants_are_denied():
    brain = MosharrofCoreBrain()
    for operation in ("DELETE_FILE", "DELETE_DIRECTORY", "DROP_DATABASE", "DESTROY_PROJECT"):
        result = brain.authorize_action(entity_id="core", operation=operation, scope="core")
        assert result["status"] == "DENIED"


def test_context_aware_voice_pipeline():
    engine = VoiceJournalEngine()
    assert engine.apply_smart_punctuation("  তুমি কি করতেছ  ") == "তুমি কি করতেছ।"
    assert engine.correct_contextual_grammar("তুমি কি করতেছ") == "তুমি কি করছ"
    result = engine.process_voice_text("তুমি কি করতেছ")
    assert result["final_text"] == "তুমি কি করছ।"


def test_voice_audio_requires_authorization_and_provider():
    engine = VoiceJournalEngine()
    assert engine.sanitize_phonetic_speech(b"audio")["status"] == "BLOCKED"
    engine.toggle_listening(True, authorized=True)
    assert engine.sanitize_phonetic_speech(b"audio")["status"] == "UNAVAILABLE"
    provider = lambda _audio: "তুমি কি করতেছ"
    engine = VoiceJournalEngine(transcription_provider=provider)
    engine.toggle_listening(True, authorized=True)
    result = engine.sanitize_phonetic_speech(b"audio")
    assert result["status"] == "SUCCESS"
    assert result["sanitized_text"] == "তুমি কি করছ।"


def test_voice_smart_punctuation_and_conservative_correction():
    voice = VoiceJournalEngine()
    assert voice.apply_smart_punctuation("আপনি কেমন আছেন") == "আপনি কেমন আছেন?"
    assert voice.apply_smart_punctuation("আজ আমরা গবেষণা করব") == "আজ আমরা গবেষণা করব।"
    assert voice.correct_contextual_grammar("মোশারফ কোরআন গবেষণা", context="quran", correction_map={"কোরআন": "কুরআন"}) == "মোশারফ কুরআন গবেষণা"


def test_voice_audio_requires_explicit_transcriber():
    voice = VoiceJournalEngine()
    voice.toggle_listening(True, authorized=True)
    assert voice.sanitize_phonetic_speech(b"audio")["status"] == "REQUIRES_TRANSCRIBER"


def test_voice_audio_pipeline_uses_transcriber_and_correction():
    voice = VoiceJournalEngine()
    voice.toggle_listening(True, authorized=True)
    result = voice.sanitize_phonetic_speech(b"audio", lambda _: "মোশারফ কোরআন গবেষণা", context="quran", correction_map={"কোরআন": "কুরআন"})
    assert result["status"] == "SUCCESS"
    assert result["text"] == "মোশারফ কুরআন গবেষণা।"


def test_tool_factory_blocks_import_and_dynamic_destructive_access(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    assert factory.create_tool("bad_import", "import subprocess\nreturn 1").startswith("DENIED:")
    assert factory.create_tool("bad_getattr", "import os\ngetattr(os, 'remove')('x')").startswith("DENIED:")
