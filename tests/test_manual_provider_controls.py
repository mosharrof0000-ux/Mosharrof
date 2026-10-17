from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
CONTROLS = (ROOT / "core" / "manual-provider-controls.js").read_text(encoding="utf-8")
PREP = (ROOT / "scripts" / "prepare_web_organ_runtime.py").read_text(encoding="utf-8")
PATCH = (ROOT / "scripts" / "manual_provider_runtime_patch.py").read_text(encoding="utf-8")
WORKER = (ROOT / "worker" / "screenshot-analysis.js").read_text(encoding="utf-8")
ROUTER = (ROOT / "core" / "manual-chat-routing.js").read_text(encoding="utf-8")


def test_manual_menus_are_isolated_in_a_dedicated_runtime_module():
    assert 'core/manual-provider-controls.js' in PREP
    assert 'manualChatModeBtn' not in CONTROLS
    assert 'sendButton' in CONTROLS
    assert 'menuFor(target,"chat")' in CONTROLS
    assert 'composerServerBtn' not in CONTROLS
    assert 'target.closest("#sendBtn")' in CONTROLS
    assert '},520);' in CONTROLS
    assert 'AI MODEL / CONNECTION' in CONTROLS
    assert 'RECORDING / SPEECH TO TEXT' in CONTROLS
    assert 'CHAT_KEY="mosharrof_chat_route_v1"' in CONTROLS
    assert 'mosharrof_stt_model_v1' in PATCH
    assert 'data-manual-menu="tts"' in CONTROLS or '.message-speak-shortcut' in CONTROLS
    assert 'web/organs/chat-manual-controls/index.js' not in PREP
    assert 'manual-provider-controls.js' in PREP


def test_manual_chat_provider_does_not_silently_fall_back():
    assert "runSelectedChat(body,env,report,fallbackText,targetWords,maxOutputTokens,{" in WORKER
    assert 'error:"selected_provider_failed"' in ROUTER
    assert "automatic fallback was not used" in ROUTER
    assert "old_tts_fallback" in PATCH
    assert 'preference==="auto"' in PATCH
    assert "অন্য ইঞ্জিনে যাওয়া হয়নি" in PATCH


def test_manual_tts_uses_only_selected_provider_and_auto_keeps_free_first():
    assert "providers=[valid]" in WORKER
    assert 'providers=expressive?["elevenlabs","edge","gemini","azure","sarvam"]:["edge","gemini","azure","sarvam"]' in WORKER


def test_transcription_model_is_user_selectable_but_auto_retains_fallback():
    assert 'const requestedModel=String(body.model||"auto").trim()' in WORKER
    assert 'requestedModel!=="auto"&&allowedModels.includes(requestedModel)?[requestedModel]:automaticPreferred' in WORKER
