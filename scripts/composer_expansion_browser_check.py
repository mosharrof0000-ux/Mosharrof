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
    assert message_input.input_value() == "composer expansion applied", (
        "composer expansion editor failed to apply edited text"
    )
    print("COMPOSER EXPANSION BROWSER CHECK: PASS")
