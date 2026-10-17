"Regression tests for the mobile message composer auto-growth behavior."
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_composer_grows_to_eight_lines_then_scrolls_internally():
    source = (ROOT / "core" / "composer-autogrow.js").read_text(encoding="utf-8")
    helper = (ROOT / "core" / "composer-line-limit.js").read_text(encoding="utf-8")
    assert "resizeComposerToEightLines(input)" in source
    assert "lineHeight * 8" in helper
    assert 'is-over-eight-lines' in helper
    assert "input.scrollTop = input.scrollHeight" in helper


def test_runtime_preparation_copies_autogrow_and_line_limit_helpers():
    prep = (ROOT / "scripts" / "prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    assert '"core/composer-autogrow.js": "web/composer-autogrow.js"' in prep
    assert '"core/composer-line-limit.js": "web/composer-line-limit.js"' in prep
    assert '"core/composer-line-limit.js": "web/core/composer-line-limit.js"' in prep
    assert 'autogrow_runtime = ROOT / "web/core/composer-autogrow.js"' in prep
    assert 'shutil.copyfile(autogrow_source, autogrow_runtime)' in prep


def test_composer_keeps_latest_line_visible_when_it_grows():
    source = (ROOT / "core" / "composer-line-limit.js").read_text(encoding="utf-8")
    assert "input.scrollTop = input.scrollHeight" in source
    assert "input.style.maxHeight = maxHeight + \"px\"" in source


def test_composer_recalculates_for_keyboard_and_visible_viewport_changes():
    source = (ROOT / "core" / "composer-autogrow.js").read_text(encoding="utf-8")
    assert 'input.addEventListener("focus", syncComposerViewport)' in source
    assert 'window.visualViewport.addEventListener("resize", syncComposerViewport' in source
    assert 'window.visualViewport.addEventListener("scroll", syncComposerViewport' in source
    assert 'composer.style.bottom = keyboardGap > 100 ? (keyboardGap + 8) + "px" : ""' in source
