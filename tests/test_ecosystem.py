"""Core integration tests for Mosharrof."""
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine
from src.core.permission_guard import PermissionGuard
from src.core.entity_registry import EntityRegistry

def test_full_ecosystem_flow(tmp_path):
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)
    tool_factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    voice_engine = VoiceJournalEngine(memory_ledger=ledger)
    storage_engine = StorageEngine(root_dir=str(tmp_path))
    assert brain.system_status()["delete_operations"] == "BLOCKED"
    assert voice_engine.toggle_listening(True)["listening_state"] == "ACTIVE"
    assert voice_engine.process_ambient_conversation("TEST_SPEAKER", "test message")["status"] == "SUCCESS"
    assert storage_engine.scan_and_index_storage()["status"] == "SUCCESS"
    assert isinstance(tool_factory.list_available_tools(), list)
    result = brain.process_intent("গবেষণার জন্য কুরআন ফাইল খুঁজে দাও")
    assert result["status"] == "SUCCESS"
    assert result["intent"] == "RESEARCH"
    assert result["intent_clarity"] == 1.0

def test_permission_guard():
    guard = PermissionGuard()
    assert guard.check("DELETE")["status"] == "DENIED"
    assert guard.check("WRITE", destructive=True)["status"] == "DENIED"
    assert guard.check("READ")["status"] == "ALLOWED"

def test_tool_factory_blocks_destructive_code(tmp_path):
    tools = ToolFactory(tools_dir=str(tmp_path / "tools"))
    assert tools.create_tool("safe", "return 1").startswith("Tool 'safe'")
    assert "DENIED" in tools.create_tool("bad", "os.remove('important.txt')")

def test_entity_registry():
    registry = EntityRegistry()
    registry.register("test.chat", role="conversation", brain="chat", scope="chat")
    assert registry.get("test.chat")["brain"] == "chat"
