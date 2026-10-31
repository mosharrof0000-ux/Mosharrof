from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_chat_and_home_organ_paths_avoid_array_at_for_legacy_webview():
    for organ in ("chat", "home"):
        source = (ROOT / "organs" / organ / "index.js").read_text(encoding="utf-8")
        assert ".at(" not in source
        assert "organPathParts[organPathParts.length - 2]" in source
