"""Regression tests for the mobile message composer auto-growth behavior."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_composer_can_grow_beyond_the_old_120px_limit():
    source = (ROOT / "core" / "composer-autogrow.js").read_text(encoding="utf-8")
    assert "max-height:min(44dvh,360px)!important" in source
    assert "Math.min(visibleHeight * 0.44, 360)" in source
    assert "Math.min(input.scrollHeight, maxHeight) + \"px\"" in source
    legacy_html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert 'function resize(){input.style.height="auto";input.style.height=Math.min(input.scrollHeight,120)+"px";}' in legacy_html


def test_runtime_preparation_copies_the_new_module_to_both_import_paths():
    prep = (ROOT / "scripts" / "prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    assert '"core/composer-autogrow.js": "web/composer-autogrow.js"' in prep
    assert 'autogrow_runtime = ROOT / "web/core/composer-autogrow.js"' in prep
    assert 'shutil.copyfile(autogrow_source, autogrow_runtime)' in prep


def test_composer_keeps_latest_line_visible_when_it_grows():
    source = (ROOT / "core" / "composer-autogrow.js").read_text(encoding="utf-8")
    assert "input.scrollTop = input.scrollHeight" in source


def test_composer_recalculates_for_keyboard_and_visible_viewport_changes():
    source = (ROOT / "core" / "composer-autogrow.js").read_text(encoding="utf-8")
    assert 'input.addEventListener("focus", syncComposerViewport)' in source
    assert 'window.visualViewport.addEventListener("resize", syncComposerViewport' in source
    assert 'window.visualViewport.addEventListener("scroll", syncComposerViewport' in source
    assert 'composer.style.bottom = keyboardGap > 100 ? (keyboardGap + 8) + "px" : ""' in source
