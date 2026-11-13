"""Browser checks for the personal voice controls embedded in Read Aloud."""

def check_personal_voice_menu(page, read_button) -> None:
    health = page.evaluate("window.MosharrofEntitySystem.organRuntime.health('personal-voice')")
    assert health["status"] == "ready", f"personal-voice Organ is not ready: {health}"
    read_button.dispatch_event("contextmenu")
    voice_menu = page.locator(".personal-voice-menu")
    voice_menu.wait_for(state="visible", timeout=10000)
    assert voice_menu.get_attribute("aria-label") == "পড়ে শোনানোর সেটিংস"
    page.get_by_role("button", name="Owner Login").wait_for(state="visible", timeout=10000)
    page.get_by_placeholder("Owner email").wait_for(state="visible", timeout=10000)
    page.get_by_placeholder("Password").wait_for(state="visible", timeout=10000)
    page.get_by_placeholder("নাম দিয়ে খুঁজুন").wait_for(state="visible", timeout=10000)
    assert page.locator("[data-message-audio-read]").count() == 1, "a separate personal voice button was added"
    add_button = voice_menu.locator("button").filter(has_text="＋ নিজের কণ্ঠ যোগ করুন")
    assert add_button.is_disabled(), "sample enrollment must wait for secure backend readiness"
    voice_menu.get_by_role("button", name="বন্ধ").click()
    assert page.locator(".personal-voice-menu").count() == 0
