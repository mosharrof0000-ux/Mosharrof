from src.core.consciousness_engine import ConsciousnessEngine


def test_entity_cannot_see_another_entity():
    engine = ConsciousnessEngine()
    # chat tries to inspect ui → must be denied
    result = engine.inspect("ui", caller_id="chat")
    assert result["status"] == "DENIED"
    assert result["reason"] == "ISOLATION_VIOLATION"


def test_entity_can_see_itself():
    engine = ConsciousnessEngine()
    result = engine.inspect("chat", caller_id="chat")
    assert result["status"] == "ACTIVE"
    assert result["entity_id"] == "chat"


def test_only_director_can_inspect_all():
    engine = ConsciousnessEngine()
    # Normal entity tries inspect_all → denied
    denied = engine.inspect_all(caller_id="chat")
    assert denied["status"] == "DENIED"
    assert denied["reason"] == "DIRECTOR_ONLY"

    # Director (core) can see all
    allowed = engine.inspect_all(caller_id="core")
    assert allowed["status"] == "ACTIVE"
    assert allowed["entity_count"] >= 1


def test_director_can_analyze_any_entity():
    engine = ConsciousnessEngine()
    engine.heartbeat("voice", signal="TEST")
    report = engine.self_analyze("voice", caller_id="core")
    assert report["status"] == "ANALYZED"
    assert report["entity_id"] == "voice"
