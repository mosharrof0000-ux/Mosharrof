from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_chat_organ_avoids_array_at_for_legacy_android_webview():
    source = (ROOT / "organs/chat/index.js").read_text(encoding="utf-8")
    assert 'pathname.split("/").at(' not in source
    assert "organPathParts[organPathParts.length - 2]" in source


def test_real_chat_visibility_probe_reports_layout_ancestors_and_keeps_strict_gate():
    source = (ROOT / "scripts/android/apk_webview_real_chat_smoke.py").read_text(encoding="utf-8")
    for marker in (
        "#chatScroll", "#messages", ".message.ai", ".rich-content",
        "minWidth", "flexBasis", "overflowX", "overflowY",
        "answer_layout_diagnostics", "answer_layout_boxes_nonzero",
        "assistant_answer_visible_in_saved_screenshot",
    ):
        assert marker in source
    assert "r.width > 0 && r.height > 0" in source
    assert "r.bottom > 0 && r.top < window.innerHeight" in source
