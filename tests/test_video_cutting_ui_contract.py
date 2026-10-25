from pathlib import Path


def test_video_cutting_chat_ui_is_modular_and_secret_free():
    html = Path("web/index.html").read_text(encoding="utf-8")
    script = Path("web/video-cutting.js").read_text(encoding="utf-8")
    styles = Path("web/video-cutting.css").read_text(encoding="utf-8")

    assert 'id="videoCuttingBtn"' in html
    assert './video-cutting.css' in html
    assert './video-cutting.js' in html
    assert 'videoCutPanel' in script
    assert '/video-cut/health' in script
    assert '/video-cut/upload' in script
    assert '/video-cut/jobs/' in script
    assert 'Authorization: "Bearer " + accessToken' in script
    assert '39 * 1024 * 1024' in script
    assert '150 * 1024 * 1024' in script
    assert 'localStorage.setItem' not in script
    assert 'sessionStorage.setItem' not in script
    assert 'VIDEO_CUTTING_API_TOKEN' not in html
    assert 'display:none!important' in styles
    assert 'video-cut-panel' in styles


def test_video_cutting_worker_proxy_is_disabled_by_default_and_server_authenticated():
    proxy = Path("worker/video-cutting-proxy.js").read_text(encoding="utf-8")
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")

    assert 'VIDEO_CUTTING_ENABLED' in proxy
    assert 'VIDEO_CUTTING_API_TOKEN' in proxy
    assert 'VIDEO_CUTTING_ACCESS_TOKEN' in proxy
    assert 'url.protocol !== "https:"' in proxy
    assert 'multipart/form-data' in proxy
    assert 'MAX_REQUEST_BYTES' in proxy
    assert 'handleVideoCuttingProxy(request,env)' in worker
    assert 'content-type,authorization' in worker
