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
    ledger=MemoryLedger(); brain=MosharrofCoreBrain(event_bus=EcosystemEventBus(),memory_ledger=ledger)
    factory=ToolFactory(tools_dir=str(tmp_path/"tools")); voice=VoiceJournalEngine(memory_ledger=ledger); storage=StorageEngine(root_dir=str(tmp_path))
    assert brain.system_status()["delete_operations"]=="BLOCKED"
    assert voice.toggle_listening(True)["listening_state"]=="BLOCKED"
    assert voice.toggle_listening(True,authorized=True)["listening_state"]=="ACTIVE"
    assert voice.process_ambient_conversation("TEST","মোশারফ প্রজেক্ট করতেছি")["transcript"]=="মোশাররফ প্রজেক্ট করছি।"
    (tmp_path/"sample.txt").write_text("test",encoding="utf-8")
    assert storage.scan_and_index_storage(str(tmp_path))["status"]=="SUCCESS"
    assert isinstance(factory.list_available_tools(),list)
    intent=brain.process_intent("গবেষণার জন্য কুরআন ফাইল খুঁজে দাও")
    assert intent["status"]=="SUCCESS" and intent["intent"]=="RESEARCH" and intent["intent_clarity"]==1.0

def test_capability_boundary():
    brain=MosharrofCoreBrain()
    assert brain.authorize_action(entity_id="core",operation="READ",scope="core")["status"]=="ALLOWED"
    assert brain.authorize_action(entity_id="core",operation="DELETE",scope="core")["status"]=="DENIED"
    assert brain.authorize_action(entity_id="core",operation="DESTRUCTIVE",scope="core")["status"]=="DENIED"
    assert brain.authorize_action(entity_id="chat",operation="WRITE",scope="chat")["status"]=="DENIED"
    assert brain.authorize_action(entity_id="chat",operation="MESSAGE",scope="chat")["status"]=="ALLOWED"

def test_delete_is_permanently_blocked():
    result=MosharrofCoreBrain().monitor_sub_agent("chat",{"status":"PROCESSING","operation":"DELETE","scope":"chat"})
    assert result["decision"]=="REJECTED" and result["integrity_check"]=="FAILED"

def test_storage_organization_is_explicitly_authorized(tmp_path):
    folder=tmp_path/"files"; folder.mkdir(); (folder/"note.txt").write_text("x",encoding="utf-8")
    result=StorageEngine(root_dir=str(tmp_path)).auto_organize_folder(str(folder))
    assert result["status"]=="SUCCESS" and (folder/"Documents"/"note.txt").exists()

def test_tool_factory_blocks_destructive_source(tmp_path):
    result=ToolFactory(tools_dir=str(tmp_path/"tools")).create_tool("bad_tool","import os\nos.remove('x')")
    assert result.startswith("DENIED:")

def test_tool_factory_blocks_dynamic_execution(tmp_path):
    factory=ToolFactory(tools_dir=str(tmp_path/"tools"))
    assert factory.create_tool("bad_eval","return eval('1+1')").startswith("DENIED:")
    assert factory.create_tool("bad_open","return open('x')").startswith("DENIED:")
    assert factory.create_tool("bad_import","import subprocess\nreturn 1").startswith("DENIED:")

def test_runtime_import_smoke():
    import src.main
    assert callable(src.main.boot_mosharrof) and src.main.boot_mosharrof_ai is src.main.boot_mosharrof

def test_storage_organizer_never_overwrites(tmp_path):
    folder=tmp_path/"files"; folder.mkdir(); source=folder/"note.txt"; source.write_text("new",encoding="utf-8")
    docs=folder/"Documents"; docs.mkdir(); existing=docs/"note.txt"; existing.write_text("existing",encoding="utf-8")
    result=StorageEngine().auto_organize_folder(str(folder))
    assert result["moved_files"]==0 and source.exists() and existing.read_text(encoding="utf-8")=="existing"

def test_tool_factory_safe_function_body_and_execution(tmp_path):
    factory=ToolFactory(tools_dir=str(tmp_path/"tools"))
    assert "created and registered" in factory.create_tool("safe_tool","return 1") and factory.execute_tool("safe_tool")==1

def test_core_audit_and_brain_adapter():
    audit=AuditLedger(); brain=MosharrofCoreBrain(audit_ledger=audit); status=brain.system_status()
    assert status["brain"]["entity_id"]=="core" and status["brain"]["model_independent_identity"] is True
    brain.authorize_action(entity_id="core",operation="READ",scope="core")
    assert audit.recent(1)[0]["action"]=="ACTION_ALLOWED"

def test_temporary_permission_cannot_grant_delete():
    manager=TemporaryPermissionManager()
    assert manager.grant("task-1",entity_id="core",operation="DELETE",scope="core",task="cleanup")["status"]=="DENIED"
    assert manager.grant("task-2",entity_id="core",operation="WRITE",scope="core/config",task="configuration")["status"]=="GRANTED"
    assert manager.complete_task("task-2")["status"]=="REVOKED"

def test_machine_readable_project_contract():
    import json
    from pathlib import Path
    root=Path(__file__).resolve().parents[1]
    manifest=json.loads((root/"config/project_manifest.json").read_text(encoding="utf-8")); registry=json.loads((root/"config/entity_registry.json").read_text(encoding="utf-8"))
    assert manifest["owner"]=="Mosharrof Karim" and manifest["immutable_safety_rules"]["delete"] is False
    assert manifest["immutable_safety_rules"]["destructive_operations"] is False
    ids={x["id"] for x in registry["entities"]}
    assert {"core","chat","sidebar","voice","storage","tool_factory","quran_research"}<=ids

def test_event_bus_isolates_subscriber_failure():
    bus=EcosystemEventBus(); received=[]
    bus.subscribe("TEST",lambda _: (_ for _ in ()).throw(RuntimeError("subscriber failure")))
    bus.subscribe("TEST",lambda data: received.append(data))
    result=bus.publish("TEST",{"ok":True})
    assert result["status"]=="PARTIAL_FAILURE" and result["delivered"]==1 and len(result["failures"])==1 and received==[{"ok":True}]

def test_additional_delete_variants_are_denied():
    brain=MosharrofCoreBrain()
    for operation in ("DELETE_FILE","DELETE_DIRECTORY","DROP_DATABASE","DESTROY_PROJECT"):
        assert brain.authorize_action(entity_id="core",operation=operation,scope="core")["status"]=="DENIED"

def test_voice_engine_smart_processing():
    engine=VoiceJournalEngine()
    assert engine.process_transcript("মোশারফ প্রজেক্ট করতেছি")["final_text"]=="মোশাররফ প্রজেক্ট করছি।"
    assert engine.process_transcript("কুরআন নিয়ে গবেষণা কীভাবে করব")["final_text"].endswith("?")
