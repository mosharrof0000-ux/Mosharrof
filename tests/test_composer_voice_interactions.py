from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
ENHANCEMENTS = (ROOT / "core" / "composer-enhancements.js").read_text(encoding="utf-8")
MANUAL_PROVIDER = (ROOT / "core" / "manual-provider-controls.js").read_text(encoding="utf-8")


class ComposerVoiceInteractionContractTests(unittest.TestCase):
    def test_text_area_is_above_bottom_action_row(self):
        textarea = HTML.index('class="composer-input-row"')
        actions = HTML.index('class="row composer-actions-row"')
        self.assertLess(textarea, actions)
        self.assertLess(actions, HTML.index('id="composerVoiceBtn"'))
        self.assertLess(actions, HTML.index('id="sendBtn"'))

    def test_provider_selection_is_sent_to_existing_chat_router(self):
        self.assertIn('stream_status:true})', HTML)
        for provider in ("auto", "gemini", "cloudflare-workers-ai", "groq", "openrouter"):
            self.assertIn(provider, MANUAL_PROVIDER)

    def test_long_press_opens_server_menu_without_a_separate_server_button(self):
        self.assertIn('target.closest("#sendBtn,.response-route")', MANUAL_PROVIDER)
        self.assertIn("},520);", MANUAL_PROVIDER)
        self.assertIn("event.stopImmediatePropagation()", MANUAL_PROVIDER)
        self.assertNotIn("manualChatModeBtn", MANUAL_PROVIDER)
        self.assertNotIn('id="serverBtn"', HTML)

    def test_provider_color_changes_only_send_icon_stroke(self):
        self.assertIn('#sendBtn svg{stroke:var(--chat-provider-accent,#f2f2f2)!important}', MANUAL_PROVIDER)
        self.assertIn('sendButton.style.setProperty("--chat-provider-accent",accents[provider]||accents.auto)', MANUAL_PROVIDER)
        self.assertNotIn('#sendBtn{background:', MANUAL_PROVIDER)

    def test_microphone_activity_uses_live_audio_level(self):
        self.assertIn("createAnalyser()", HTML)
        self.assertIn("getByteTimeDomainData(samples)", HTML)
        self.assertIn("rms>=0.025", HTML)
        self.assertIn('classList.toggle("has-voice-activity",active)', HTML)
        self.assertIn('#composerVoiceBtn.has-voice-activity{background:#080808', HTML)

    def test_send_resets_size_and_restores_failed_draft(self):
        self.assertIn('input.style.height="40px";input.scrollTop=0;resize();', HTML)
        self.assertIn('if(!input.value.trim()&&raw)input.value=raw;resize();', HTML)

    def test_fullscreen_editor_remains_available(self):
        self.assertIn("mosharrofExpandEditor", ENHANCEMENTS)
        self.assertIn("data-expand-apply", ENHANCEMENTS)
        self.assertIn("data-expand-cancel", ENHANCEMENTS)
        self.assertIn("initializeComposerAutoGrow(input, composer)", ENHANCEMENTS)


if __name__ == "__main__":
    unittest.main()
