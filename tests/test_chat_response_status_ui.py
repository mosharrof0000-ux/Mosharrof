from pathlib import Path


def test_chat_response_timer_reuses_existing_voice_timer_box_with_color_only_change():
    html = Path("web/index.html").read_text(encoding="utf-8")
    voice_css = html.split(".voice-companion{", 1)[1].split("}", 1)[0]
    response_css = html.split(".response-timer{", 1)[1].split("}", 1)[0]
    assert "min-width:48px;height:28px;padding:0 7px" in voice_css
    assert "border:1px solid rgba(255,255,255,.2);border-radius:9px;background:#111" in voice_css
    assert "min-width:48px;height:28px;padding:0 7px" in response_css
    assert "border:1px solid rgba(255,255,255,.2);border-radius:9px;background:#111" in response_css
    assert "font:11px/1.1 ui-monospace,SFMono-Regular,Consolas,monospace" in response_css
    assert "color:#39ff78" in response_css
    assert ".response-timer.is-error{color:#ff4545}" in html
    assert "text-shadow" not in response_css
    assert "filter:" not in response_css
    assert "box-shadow:" not in response_css


def test_chat_timer_shows_live_elapsed_time_and_compact_provider_route():
    html = Path("web/index.html").read_text(encoding="utf-8")
    assert 'প্রথম চেষ্টা: Gemini' in html
    assert "function providerShortName(provider)" in html
    assert "function chatRouteSummary(meta)" in html
    assert 'var answered=winner+(modelLabel?" · "+modelLabel:"")' in html
    assert "শুরু: " in html and "বিকল্প: " in html and "উত্তর: " in html
    assert 'route.textContent=chatRouteSummary(responseMeta)' in html
    assert 'timer.textContent="⏱ "+elapsedLabel(elapsedMs)' in html
    assert 'timer.textContent="⏱ "+elapsedLabel(performance.now()-started)' in html


def test_chat_provider_metadata_is_taken_from_worker_and_persisted_in_history():
    html = Path("web/index.html").read_text(encoding="utf-8")
    assert 'provider:data.provider||null' in html
    assert 'attempted:Array.isArray(data.attempted)?data.attempted:[]' in html
    assert 'savedMessage.responseMeta=responseMeta' in html
    assert 'rm.responseMeta' in html
    assert 'm.responseMeta' in html
    assert 'failure.responseMeta={provider:null,model:null,attempted:responseMeta.attempted,failed:true}' in html


def test_provider_failure_status_and_fallback_order_are_explicit():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert 'error:"chat_provider_failed"' in worker
    assert 'reason:"not_configured"' in worker
    assert 'chat_provider_order:["gemini","cloudflare-workers-ai","groq","openrouter"]' in worker
    assert "AbortSignal.timeout" in worker
