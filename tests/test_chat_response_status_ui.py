from pathlib import Path


def test_chat_response_timer_uses_neon_text_without_recoloring_message_box():
    html = Path("web/index.html").read_text(encoding="utf-8")
    assert ".response-timer{flex:none;color:#39ff78" in html
    assert ".response-timer.is-error{color:#ff4545" in html
    assert "text-shadow:0 0 4px rgba(57,255,120,.9)" in html
    assert "text-shadow:0 0 4px rgba(255,69,69,.95)" in html
    assert ".response-timer{" in html
    timer_css = html.split(".response-timer{", 1)[1].split("}", 1)[0]
    assert "background:" not in timer_css
    assert "box-shadow:" not in timer_css


def test_chat_timer_shows_live_elapsed_time_and_compact_provider_route():
    html = Path("web/index.html").read_text(encoding="utf-8")
    assert 'প্রথম চেষ্টা: Gemini' in html
    assert "function providerShortName(provider)" in html
    assert "function chatRouteSummary(meta)" in html
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
