from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_pages_source_loads_edge_to_edge_stylesheet():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert 'href="./edge-to-edge.css?v=20261013-1"' in html
    assert "viewport-fit=cover" in html


def test_edge_to_edge_contract_keeps_full_viewport_and_frosted_header():
    css = (ROOT / "web" / "edge-to-edge.css").read_text(encoding="utf-8")
    assert "height:100dvh" in css
    assert "safe-area-inset-top" in css
    assert "safe-area-inset-bottom" in css
    assert "backdrop-filter:blur(18px) saturate(160%) !important;" in css
    assert "-webkit-backdrop-filter:blur(18px) saturate(160%) !important;" in css
    assert ".top .brand{display:none !important;}" in css
