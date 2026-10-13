from pathlib import Path


def test_chat_status_stream_updates_provider_during_fallback():
    html = Path("web/index.html").read_text(encoding="utf-8")
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "stream_status:true" in html
    assert "function updateLiveChatRoute(event)" in html
    assert 'event.stage==="trying"' in html
    assert 'event.stage==="failed"' in html
    assert 'event.stage==="answered"' in html
    assert 'type:"status"' in worker
    assert 'content-type":"text/event-stream; charset=utf-8"' in worker
    assert "async function runChat(body,env,onStatus)" in worker
    assert "stream_status!==true" in worker
