from src.core.consciousness_engine import ConsciousnessEngine


def test_every_registered_entity_has_live_state():
    engine = ConsciousnessEngine()
    snapshot = engine.inspect_all()
    assert snapshot["status"] == "ACTIVE"
    assert snapshot["entity_count"] >= 1
    assert all(item["state"] == "ACTIVE" for item in snapshot["entities"])
    assert all(item["delete_allowed"] is False for item in snapshot["entities"])


def test_entity_heartbeat_updates_live_state():
    engine = ConsciousnessEngine()
    result = engine.heartbeat("chat", signal="USER_MESSAGE")
    assert result["status"] == "ACTIVE"
    assert result["entity_id"] == "chat"
    assert result["heartbeat"] == 1
    assert engine.inspect("chat")["last_seen"] is not None


def test_awareness_broadcast_rejects_unknown_entities():
    engine = ConsciousnessEngine()
    result = engine.broadcast_awareness(
        "SYSTEM_SYNC", {"source": "core"}, recipients=["chat", "missing"]
    )
    assert result["status"] == "DENIED"


def test_awareness_broadcast_uses_shared_event_bus():
    engine = ConsciousnessEngine()
    received = []
    engine.event_bus.subscribe("SYSTEM_SYNC", received.append)
    result = engine.broadcast_awareness(
        "SYSTEM_SYNC", {"source": "core"}, recipients=["chat"]
    )
    assert result["status"] == "SUCCESS"
    assert received[0]["recipients"] == ["chat"]
