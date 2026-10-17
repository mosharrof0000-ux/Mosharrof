from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
ENHANCEMENTS = (ROOT / "core" / "composer-enhancements.js").read_text(encoding="utf-8")
LAYOUT = (ROOT / "core" / "composer-layout.js").read_text(encoding="utf-8")
VOICE_METER = (ROOT / "core" / "composer-voice-meter.js").read_text(encoding="utf-8")
MANUAL_PROVIDER = (ROOT / "core" / "manual-provider-controls.js").read_text(encoding="utf-8")
PROVIDER_PATCH = (ROOT / "scripts" / "manual_provider_runtime_patch.py").read_text(encoding="utf-8")
PREP_SCRIPT = (ROOT / "scripts" / "prepare_web_organ_runtime.py").read_text(encoding="utf-8")


class ComposerVoiceInteractionContractTests(unittest.TestCase):
    def test_text_area_is_moved_above_bottom_action_row_at_runtime(self):
        self.assertIn('input.closest(".row")', LAYOUT)
        self.assertIn('inputRow.appendChild(input)', LAYOUT)
        self.assertIn('existingRow.classList.add("composer-actions-row")', LAYOUT)
        self.assertIn('#composer .composer-input-row .input', LAYOUT)

    def test_provider_selection_is_sent_to_existing_chat_router(self):
        # Tests run before Pages preparation, so the source HTML keeps the stable anchor.
        # The preparation patch must transform it to include the selected provider/model.
        self.assertIn('body:JSON.stringify({text:String(t||"").trim(),image:image?image.dataUrl:null,image_name:image?image.name:null,stream_status:true})', HTML)
        self.assertIn("apply_manual_provider_patches(index_html)", PREP_SCRIPT)
        self.assertIn('new_chat_request = ', PROVIDER_PATCH)
        self.assertIn('provider:(function(){try{return (localStorage.getItem("mosharrof_chat_route_v1")||"auto").split("|")[0];}', PROVIDER_PATCH)
        self.assertIn('model:(function(){try{return (localStorage.getItem("mosharrof_chat_route_v1")||"auto").split("|")[1]||"";}', PROVIDER_PATCH)
        for provider in ("auto", "gemini", "cloudflare-workers-ai", "groq", "openrouter"):
            self.assertIn(provider, MANUAL_PROVIDER)

    def test_long_press_opens_server_menu_without_a_separate_server_button(self):
        self.assertIn('target.closest("#sendBtn,.response-route")', MANUAL_PROVIDER)
        self.assertIn("},520);", MANUAL_PROVIDER)
        self.assertIn("e.stopImmediatePropagation()", MANUAL_PROVIDER)
        self.assertNotIn("manualChatModeBtn", MANUAL_PROVIDER)
        self.assertNotIn('id="serverBtn"', HTML)

    def test_provider_color_changes_only_send_icon_stroke(self):
        self.assertIn('#sendBtn svg{stroke:var(--chat-provider-accent,#f2f2f2)!important}', MANUAL_PROVIDER)
        self.assertIn('sendButton.style.setProperty("--chat-provider-accent",accents[provider]||accents.auto)', MANUAL_PROVIDER)
        self.assertNotIn('#sendBtn{background:', MANUAL_PROVIDER)

    def test_microphone_activity_uses_live_audio_level(self):
        self.assertIn("createAnalyser()", VOICE_METER)
        self.assertIn('document.addEventListener("vm", event => start(event.detail))', VOICE_METER)
        self.assertIn('document.dispatchEvent(new CustomEvent("vm",{detail:voiceStream}))', PROVIDER_PATCH)
        self.assertIn("getByteTimeDomainData(samples)", VOICE_METER)
        self.assertIn("Math.sqrt(energy / samples.length) >= 0.025", VOICE_METER)
        self.assertIn('classList.toggle("has-voice-activity", Math.sqrt(energy / samples.length) >= 0.025)', VOICE_METER)
        self.assertIn('#composerVoiceBtn.has-voice-activity{background:#080808', LAYOUT)

    def test_send_resets_size_and_restores_failed_draft(self):
        self.assertIn('input.value="";resize();', HTML)
        self.assertIn('let submittedDraft = ""', LAYOUT)
        self.assertIn('input.value = submittedDraft', LAYOUT)
        self.assertIn('.response-timer.is-error', LAYOUT)

    def test_fullscreen_editor_remains_available(self):
        self.assertIn("mosharrofExpandEditor", ENHANCEMENTS)
        self.assertIn("data-expand-apply", ENHANCEMENTS)
        self.assertIn("data-expand-cancel", ENHANCEMENTS)
        self.assertIn("initializeComposerAutoGrow(input, composer)", ENHANCEMENTS)


if __name__ == "__main__":
    unittest.main()
