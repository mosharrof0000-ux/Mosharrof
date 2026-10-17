from pathlib import Path


def test_chat_organ_loads_personal_memory_bridge_and_pages_bundles_dependencies():
    chat = Path("organs/chat/index.js").read_text(encoding="utf-8")
    prepare = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    bridge = Path("core/personal-memory-bridge.js").read_text(encoding="utf-8")
    engine = Path("core/personal-memory-engine.js").read_text(encoding="utf-8")

    assert 'from "../../core/personal-memory-bridge.js"' in chat
    assert "installPersonalMemoryBridge();" in chat
    assert '"core/personal-memory-engine.js": "web/core/personal-memory-engine.js"' in prepare
    assert '"core/personal-memory-bridge.js": "web/core/personal-memory-bridge.js"' in prepare
    assert '"web/runtime/core" / name' in prepare
    assert '<script type="module">import "./runtime/core/personal-memory-bridge.js";</script>' in prepare
    assert "timeline: engine.timeline" in bridge
    assert "timeline" in engine
