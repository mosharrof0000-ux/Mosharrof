from pathlib import Path

def test_pages_preparation_copies_memory_bridge_and_its_engine_dependency():
    prepare = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    sidebar = Path("web/sidebar-recovery.js").read_text(encoding="utf-8")
    bridge = Path("core/personal-memory-bridge.js").read_text(encoding="utf-8")

    assert '"core/personal-memory-engine.js": "web/core/personal-memory-engine.js"' in prepare
    assert '"core/personal-memory-bridge.js": "web/core/personal-memory-bridge.js"' in prepare
    assert 'import("./core/personal-memory-bridge.js")' in sidebar
    assert 'import("../core/personal-memory-bridge.js")' not in sidebar
    assert 'from "./personal-memory-engine.js"' in bridge
