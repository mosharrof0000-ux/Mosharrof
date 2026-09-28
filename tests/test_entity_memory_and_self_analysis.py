from src.core.consciousness_engine import ConsciousnessEngine
from src.core.entity_memory import EntityMemoryBank


def test_every_entity_gets_isolated_memory():
    bank = EntityMemoryBank()
    bank.remember("chat", "USER_MESSAGE", {"text": "hello"})
    bank.remember("ui", "CLICK", {"button": "submit"})

    chat_mem = bank.inspect("chat")
    ui_mem = bank.inspect("ui")

    assert chat_mem["short_term_count"] == 1
    assert ui_mem["short_term_count"] == 1
    assert chat_mem["entity_id"] == "chat"
    assert ui_mem["entity_id"] == "ui"


def test_entity_can_self_analyze():
    engine = ConsciousnessEngine()
    # Give it some life first
    engine.heartbeat("chat", signal="TEST")
    report = engine.self_analyze("chat")

    assert report["status"] == "ANALYZED"
    assert report["entity_id"] == "chat"
    assert report["health"] in ("HEALTHY", "NEEDS_ATTENTION")
    assert "analyzed_at" in report


def test_propose_improvement_never_auto_executes():
    engine = ConsciousnessEngine()
    result = engine.propose_improvement("chat")

    assert result["status"] == "PROPOSAL_READY"
    assert result["auto_execute"] is False
    assert isinstance(result["proposals"], list)
    assert len(result["proposals"]) >= 1


def test_memory_survives_across_heartbeats():
    engine = ConsciousnessEngine()
    engine.heartbeat("voice", signal="START")
    engine.heartbeat("voice", signal="STOP")

    mem = engine.memory_bank.inspect("voice")
    assert mem["short_term_count"] >= 2
