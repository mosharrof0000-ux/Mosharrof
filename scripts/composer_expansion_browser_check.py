"""Browser-level smoke test for the live composer expansion editor."""
from playwright.sync_api import Page


def check_composer_expansion(page: Page) -> None:
    message_input = page.locator("#input")
    message_input.fill("composer expansion smoke test")
    expand_button = page.locator("#composerExpandBtn")
    expand_button.wait_for(state="visible", timeout=10000)
    expand_button.click()
    editor = page.locator("#mosharrofExpandEditor")
    editor.wait_for(state="visible", timeout=5000)
    expanded_input = editor.locator("textarea")
    assert expanded_input.input_value() == "composer expansion smoke test", (
        "composer expansion editor did not copy the full draft"
    )
    expanded_input.fill("composer expansion applied")
    editor.locator("[data-expand-apply]").click()
    page.wait_for_function("document.querySelector('#input') && document.querySelector('#input').value === 'composer expansion applied'", timeout=10000)
    actual = message_input.input_value()
    assert actual == "composer expansion applied", f"composer expansion editor failed to apply edited text; got {actual!r}"
    print("COMPOSER EXPANSION BROWSER CHECK: PASS")
