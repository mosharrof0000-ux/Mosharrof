"""Regression tests for the mobile message composer auto-growth behavior."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_composer_can_grow_beyond_the_old_120px_limit():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert "max-height:min(44dvh,360px)" in html
    assert "Math.min(visibleHeight*0.44,360)" in html
    assert 'Math.min(input.scrollHeight,maxHeight)+"px"' in html
    assert "Math.min(input.scrollHeight,120)" not in html


def test_composer_keeps_latest_line_visible_when_it_grows():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert "input.scrollTop=input.scrollHeight" in html


def test_composer_recalculates_for_keyboard_and_visible_viewport_changes():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert 'input.addEventListener("focus",syncComposerViewport)' in html
    assert 'window.visualViewport.addEventListener("resize",syncComposerViewport' in html
    assert 'window.visualViewport.addEventListener("scroll",syncComposerViewport' in html
    assert 'composer.style.bottom=keyboardGap>100?(keyboardGap+8)+"px":""' in html
