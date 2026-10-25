"""Compatibility guard for Android System WebView versions predating Array.prototype.at."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_array_at_polyfill_is_loaded_before_organ_modules():
    bootstrap = (ROOT / "web" / "entities" / "organ-bootstrap.js").read_text(encoding="utf-8")
    generator = (ROOT / "scripts" / "prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    polyfill = (ROOT / "core" / "array-at-polyfill.js").read_text(encoding="utf-8")

    assert bootstrap.splitlines()[0] == 'import "../core/array-at-polyfill.js";'
    assert '"core/array-at-polyfill.js": "web/core/array-at-polyfill.js"' in generator
    assert '"web/core/array-at-polyfill.js"' in generator
    assert "if (typeof Array.prototype.at !== \"function\")" in polyfill
    assert "if (relativeIndex < 0) relativeIndex += length;" in polyfill
    assert "if (relativeIndex < 0 || relativeIndex >= length) return undefined;" in polyfill
