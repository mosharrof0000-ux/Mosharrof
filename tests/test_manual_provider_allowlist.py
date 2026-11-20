from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTROLS = (ROOT / "core" / "manual-provider-controls.js").read_text(encoding="utf-8")
WORKER = (ROOT / "worker" / "screenshot-analysis.js").read_text(encoding="utf-8")

def test_manual_chat_menu_hides_unverified_and_optional_provider_choices():
    choices = CONTROLS[CONTROLS.index("var chatChoices=["):CONTROLS.index("var ttsChoices=[")]
    assert 'value:"auto"' in choices
    assert 'value:"gemini|gemini-3.6-flash"' in choices
    assert 'cloudflare-workers-ai|@cf/zai-org/glm-4.7-flash' in choices
    assert 'cloudflare-workers-ai|@cf/meta/llama-3.3-70b-instruct-fp8-fast' in choices
    for unavailable in ("gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash", 'value:"groq|', 'value:"openrouter|'):
        assert unavailable not in choices
    # Hiding optional providers from manual selection must not remove automatic server-side failover.
    assert '"groq","https://api.groq.com/openai/v1/chat/completions"' in WORKER
    assert '"openrouter","https://openrouter.ai/api/v1/chat/completions"' in WORKER

