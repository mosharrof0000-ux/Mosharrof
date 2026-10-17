from pathlib import Path
import unittest

from scripts.manual_provider_runtime_patch import apply_manual_provider_patches


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
ENHANCEMENTS = (ROOT / "core" / "composer-enhancements.js").read_text(encoding="utf-8")
LAYOUT = (ROOT / "core" / "composer-layout.js").read_text(encoding="utf-8")
VOICE_METER = (ROOT / "core" / "composer-voice-meter.js").read_text(encoding="utf-8")
MANUAL_PROVIDER = (ROOT / "core" / "manual-provider-controls.js").read_text(encoding="utf-8")
PROVIDER_PATCH = (ROOT / "scripts" / "manual_provider_runtime_patch.py").read_text(encoding="utf-8")
PREP_SCRIPT = (ROOT / "scripts" / "prepare_web_organ_runtime.py").read_text(encoding="utf-8")
LIVE_INSPECTOR = (ROOT / "scripts" / "live_screen_inspector.py").read_text(encoding="utf-8")


class ComposerVoiceInteractionContractTests(unittest.TestCase):
    def test_text_area_is_moved_above_bottom_action_row_at_runtime(self):
        self.assertIn('input.closest(".row")', LAYOUT)
        self.assertIn('min-height:44px!important;height:44px', LAYOUT)
        self.assertIn('width:100%;max-width:100%', LAYOUT)
        self.assertIn('lineHeight * 8', (ROOT / 'core' / 'composer-line-limit.js').read_text(encoding='utf-8'))
        self.assertIn('.mosharrof-stop-action:disabled{display:none!important}', (ROOT / 'core' / 'composer-stop.js').read_text(encoding='utf-8'))
        self.assertIn('toolsMenu.appendChild(button)', (ROOT / 'core' / 'video-generation-ui.js').read_text(encoding='utf-8'))
        self.assertIn('inputRow.appendChild(input)', LAYOUT)
        self.assertIn('existingRow.classList.add("composer-actions-row")', LAYOUT)
        self.assertIn('#composer .composer-input-row .input', LAYOUT)

    def test_live_inspector_checks_composer_space_and_server_menu(self):
        self.assertIn('composer_expand_hidden_through_eight_lines', LIVE_INSPECTOR)
        self.assertIn('composer_input_uses_full_width_and_readable_height', LIVE_INSPECTOR)
        self.assertIn('composer_send_long_press_opens_provider_menu', LIVE_INSPECTOR)
        self.assertIn('composer_expander_appears_on_ninth_line', LIVE_INSPECTOR)
        self.assertIn('composer_stop_hidden_when_idle', LIVE_INSPECTOR)
        self.assertIn('composer_video_tool_is_inside_plus_menu', LIVE_INSPECTOR)

    def test_provider_selection_is_sent_to_existing_chat_router(self):
        # Exercise the deploy-time transform itself; pytest suites may prepare web/index.html first.
        patched_html = apply_manual_provider_patches(HTML)
        self.assertIn("apply_manual_provider_patches(index_html)", PREP_SCRIPT)
        self.assertIn('provider:(function(){try{return (localStorage.getItem("mosharrof_chat_route_v1")||"auto").split("|")[0];}', patched_html)
        self.assertIn('model:(function(){try{return (localStorage.getItem("mosharrof_chat_route_v1")||"auto").split("|")[1]||"";}', patched_html)
        for provider in ("auto", "gemini", "cloudflare-workers-ai", "groq", "openrouter"):
            self.assertIn(provider, MANUAL_PROVIDER)

    def test_provider_picker_uses_send_long_press_without_a_server_pill(self):
        self.assertNotIn('id = "composerServerBtn"', ENHANCEMENTS)
        self.assertNotIn('insertBefore(serverButton, voice', ENHANCEMENTS)
        self.assertIn('target.closest("#sendBtn")', MANUAL_PROVIDER)
        self.assertIn('menuFor(target,"chat")', MANUAL_PROVIDER)
        self.assertIn("},520);", MANUAL_PROVIDER)
        self.assertIn("e.stopImmediatePropagation()", MANUAL_PROVIDER)
        self.assertNotIn('target.closest("#composerServerBtn")', MANUAL_PROVIDER)

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
        self.assertIn('submittedDraftVersion = draftVersion', LAYOUT)
        self.assertIn('event.key === "Enter" && !event.shiftKey', LAYOUT)
        self.assertIn('.message.ai:not(.typing)', LAYOUT)
        self.assertIn('.response-timer.is-error', LAYOUT)

    def test_fullscreen_editor_remains_available(self):
        self.assertIn("mosharrofExpandEditor", ENHANCEMENTS)
        self.assertIn("data-expand-apply", ENHANCEMENTS)
        self.assertIn("data-expand-cancel", ENHANCEMENTS)
        self.assertIn("initializeComposerAutoGrow(input, composer)", ENHANCEMENTS)


if __name__ == "__main__":
    unittest.main()
