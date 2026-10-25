"""Compatibility guard for Android System WebView versions predating Array.prototype.at."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_array_at_polyfill_runs_before_page_runtime_scripts():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    marker = 'id="mosharrof-array-at-polyfill"'
    assert marker in html
    polyfill_at = html.index(marker)
    head_end = html.index("</head>")
    first_external_script = html.index("<script src=")
    assert polyfill_at < first_external_script < head_end
    assert "if (!Array.prototype.at)" in html
    assert 'Object.defineProperty(Array.prototype, "at"' in html
    assert "if (relative < 0) relative += length;" in html
    assert "if (relative < 0 || relative >= length) return undefined;" in html
