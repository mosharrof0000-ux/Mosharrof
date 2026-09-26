import tempfile
from pathlib import Path
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine
from src.core.permission_policy import PermissionPolicy

def test_full_ecosystem_flow():
    event_bus=EcosystemEventBus(); ledger=MemoryLedger()
    policy=PermissionPolicy({"READ","WRITE","UPDATE","CREATE","EXECUTE","MOVE"})
    brain=MosharrofCoreBrain(event_bus=event_bus,memory_ledger=ledger,permission_policy=policy)
    tool_factory=ToolFactory(permission_policy=policy)
    with tempfile.TemporaryDirectory() as temp_dir:
        voice_engine=VoiceJournalEngine(memory_ledger=ledger)
        storage_engine=StorageEngine(root_dir=temp_dir,permission_policy=policy)
        assert voice_engine.toggle_listening(True)["listening_state"]=="ACTIVE"
        assert voice_engine.process_ambient_conversation("SPEAKER_TEST_01","Test conversation")["status"]=="SUCCESS"
        Path(temp_dir,"note.txt").write_text("test",encoding="utf-8")
        assert storage_engine.scan_and_index_storage(temp_dir)["status"]=="SUCCESS"
        assert isinstance(tool_factory.list_available_tools(),list)
        brain_res=brain.process_intent("Organize the project files")
        assert brain_res["status"]=="SUCCESS" and brain_res["intent_clarity"]>0
        assert brain.check_permission("DELETE")["status"]=="DENIED"

def test_tool_factory_blocks_destructive_source():
    policy=PermissionPolicy({"CREATE","EXECUTE"})
    factory=ToolFactory(permission_policy=policy)
    result=factory.create_tool("unsafe","import os; os.remove('x')")
    assert result.startswith("DENIED")

def test_permission_policy_boundaries():
    policy=PermissionPolicy({"READ","WRITE","UPDATE","CREATE","EXECUTE"})
    assert policy.check("READ")["status"]=="ALLOWED"
    assert policy.check("DELETE")["status"]=="DENIED"
    assert policy.check("DESTRUCTIVE")["status"]=="DENIED"
