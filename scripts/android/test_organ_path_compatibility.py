import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_all_organ_entrypoints_avoid_array_at_for_legacy_webview():
    entrypoints = sorted((ROOT / "organs").glob("*/index.js"))
    assert entrypoints
    for path in entrypoints:
        source = path.read_text(encoding="utf-8")
        assert ".at(" not in source, f"Unsupported Array.prototype.at usage in {path}"


def test_android_chat_canvas_uses_physical_offsets_for_legacy_webview():
    css = (ROOT / "core" / "android-edge-to-edge.css").read_text(encoding="utf-8")
    for selector in (".hero", ".chat-scroll"):
        match = re.search(rf"{re.escape(selector)}\s*\{{([^}}]*)\}}", css)
        assert match, f"Missing {selector} rule"
        rule = match.group(1)
        for edge in ("top", "right", "bottom", "left"):
            assert re.search(rf"\b{edge}\s*:\s*0\s*!important", rule), (
                f"{selector} must declare legacy-compatible {edge}: 0"
            )
    hero = re.search(r"\.hero\s*\{([^}]*)\}", css).group(1)
    assert re.search(r"\bwidth\s*:\s*100%\s*!important", hero)
    assert re.search(r"\bheight\s*:\s*100%\s*!important", hero)
