from pathlib import Path


def test_personal_memory_modules_are_copied_to_the_pages_artifact():
    prep = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    assert '"core/personal-memory-engine.js": "web/core/personal-memory-engine.js"' in prep
    assert '"core/personal-memory-bridge.js": "web/core/personal-memory-bridge.js"' in prep
    assert '"web/core/personal-memory-engine.js", "web/core/personal-memory-bridge.js"' in prep


def test_sidebar_loads_the_deployed_memory_bridge_path():
    sidebar = Path("web/sidebar-recovery.js").read_text(encoding="utf-8")
    assert 'import("./core/personal-memory-bridge.js")' in sidebar
    assert 'import("../core/personal-memory-bridge.js")' not in sidebar


def test_bridge_prioritizes_recent_chat_summary_before_long_term_memory():
    bridge = Path("core/personal-memory-bridge.js").read_text(encoding="utf-8")
    assert "CURRENT CHAT SUMMARY (recent turns, not long-term truth)" in bridge
    assert "requestBody.history.slice(-8)" in bridge
    assert "memory_context: prioritizedContext" in bridge
    assert "currentSummary ? " in bridge
