from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_personal_memory_modules_are_bundled_for_pages():
    sidebar = (ROOT / "web/sidebar-recovery.js").read_text(encoding="utf-8")
    prepare = (ROOT / "scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    assert 'import("./core/personal-memory-bridge.js")' in sidebar
    assert 'import("../core/personal-memory-bridge.js")' not in sidebar
    assert '"core/personal-memory-engine.js": "web/core/personal-memory-engine.js"' in prepare
    assert '"core/personal-memory-bridge.js": "web/core/personal-memory-bridge.js"' in prepare
