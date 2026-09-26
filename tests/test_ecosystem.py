from pathlib import Path
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine

def test_core_brain_activation_and_routing():
    brain = MosharrofCoreBrain(event_bus=EcosystemEventBus(), memory_ledger=MemoryLedger())
    result = brain.process_intent('Please organize my files')
    assert result['status'] == 'SUCCESS'
    assert result['intent'] == 'STORAGE'
    assert result['routed_to'] == 'storage'

def test_event_bus_and_memory_ledger():
    bus, ledger, received = EcosystemEventBus(), MemoryLedger(), []
    bus.subscribe('SYSTEM_ALERT', received.append)
    bus.publish('SYSTEM_ALERT', {'message':'ok'})
    ledger.record_event('TEST', {'ok':True})
    assert received == [{'message':'ok'}]
    assert ledger.recall_recent_events(1)[0]['event_type'] == 'TEST'

def test_no_delete_policy():
    result = MosharrofCoreBrain().monitor_sub_agent('storage', {'status':'PROCESSING','operation':'DELETE'})
    assert result['decision'] == 'REJECTED'

def test_voice_engine_records_to_shared_ledger():
    ledger = MemoryLedger()
    voice = VoiceJournalEngine(memory_ledger=ledger)
    assert voice.toggle_listening(True)['listening_state'] == 'ACTIVE'
    assert voice.process_ambient_conversation('SPEAKER_TEST_01','test conversation')['status'] == 'SUCCESS'
    assert ledger.recall_recent_events(1)[0]['event_type'] == 'SOCIAL_INTERACTION_LOGGED'

def test_storage_engine_uses_isolated_fixture(tmp_path: Path):
    fixture = tmp_path / 'fixture'
    fixture.mkdir()
    (fixture / 'document.txt').write_text('fixture', encoding='utf-8')
    (fixture / 'cache.tmp').write_text('temporary', encoding='utf-8')
    result = StorageEngine(root_dir=str(fixture)).scan_and_index_storage()
    assert result['status'] == 'SUCCESS'
    assert result['total_files_scanned'] == 2
    assert result['junk_files_count'] == 1

def test_tool_factory_registry(tmp_path: Path):
    tools_dir = tmp_path / 'tools'
    tools_dir.mkdir()
    (tools_dir / 'hello.py').write_text("def run(*args, **kwargs):\n    return 'hello'\n", encoding='utf-8')
    factory = ToolFactory(tools_dir=str(tools_dir))
    assert 'hello' in factory.list_available_tools()
    assert factory.execute_tool('hello') == 'hello'