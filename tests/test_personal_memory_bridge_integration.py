from pathlib import Path


def test_personal_memory_bridge_is_copied_and_initialized_in_pages_artifact():
    prep = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    engine = Path("core/personal-memory-engine.js").read_text(encoding="utf-8")
    bridge = Path("core/personal-memory-bridge.js").read_text(encoding="utf-8")
    assert '"core/personal-memory-engine.js": "web/core/personal-memory-engine.js"' in prep
    assert '"core/personal-memory-bridge.js": "web/core/personal-memory-bridge.js"' in prep
    assert '"web/runtime/core" / name' in prep
    assert '<script type="module">import "./runtime/core/personal-memory-bridge.js";</script>' in prep
    assert '"web/runtime/core/personal-memory-engine.js"' in prep
    assert '"web/runtime/core/personal-memory-bridge.js"' in prep
    assert "installPersonalMemoryBridge();" in bridge
    assert "createPersonalMemoryEngine" in bridge and "buildContext" in bridge
    assert "indexedDB" in engine
    assert "current request takes priority" in engine.lower()
