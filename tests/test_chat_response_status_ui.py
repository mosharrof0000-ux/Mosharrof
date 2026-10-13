from pathlib import Path


def test_chat_response_timer_uses_crisp_compact_box_without_glow():
    html = Path("web/index.html").read_text(encoding="utf-8")
    assert ".response-timer{flex:none;display:inline-flex" in html
    assert "min-width:48px;height:28px;padding:0 7px" in html
    assert "border:1px solid rgba(57,255,120,.62)" in html
    assert "background:#07150b;color:#39ff78" in html
    assert ".response-timer.is-error{border-color:rgba(255,69,69,.72)" in html
    assert "background:#1b0808;color:#ff4545" in html
    timer_css = html.split(".response-timer{", 1)[1].split("}", 1)[0]
    error_css = html.split(".response-timer.is-error{", 1)[1].split("}", 1)[0]
    assert "text-shadow:none" in timer_css
    assert "filter:none" in timer_css
    assert "box-shadow:none" in timer_css
    assert "text-shadow:none" in error_css
    assert "filter:none" in error_css
    assert "box-shadow:none" in error_css
    assert "text-shadow:0 0 4px" not in timer_css + error_css


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
