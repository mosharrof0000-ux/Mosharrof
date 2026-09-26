from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

def test_core_contract():
    brain = MosharrofCoreBrain(event_bus=EcosystemEventBus(), memory_ledger=MemoryLedger())
    assert brain.consciousness_state == "ACTIVE_COORDINATION"
    result = brain.process_intent("organize the project")
    assert result["status"] == "SUCCESS"
    assert brain.memory_ledger.recall_recent_events(1)[0]["event_type"] == "INTENT_RECEIVED"

def test_delete_policy_is_hard_disabled():
    import json
    with open("config/permission_policy.json", encoding="utf-8") as f:
        policy = json.load(f)
    assert policy["global"]["allow_delete"] is False
    assert policy["global"]["allow_destructive_operations"] is False
