from pathlib import Path

def read(path):
    return Path(path).read_text(encoding="utf-8")


def test_video_cutting_chat_ui_is_modular_and_secret_free():
    html, loader, recovery, script, download, styles = (
        read(p) for p in (
            "web/index.html", "core/video-cutting/loader.js", "web/sidebar-recovery.js",
            "core/video-cutting/ui.js", "core/video-cutting/download.js", "core/video-cutting/styles.css"
        )
    )
    for value in (
        './sidebar-recovery.js', 'video-cutting/loader.js', 'download.js', 'ui.js',
        'videoCuttingBtn', 'videoCutPanel', '/video-cut/health', '/video-cut/upload',
        '/video-cut/jobs/', 'Authorization: "Bearer " + accessToken', '39 * 1024 * 1024',
        '150 * 1024 * 1024', 'display:none!important', 'video-cut-panel'
    ):
        assert value in html + loader + recovery + script + download + styles
    assert 'localStorage.setItem' not in script
    assert 'sessionStorage.setItem' not in script
    assert 'VIDEO_CUTTING_API_TOKEN' not in html


def test_video_cutting_worker_proxy_is_disabled_by_default_and_server_authenticated():
    proxy, worker, wrangler = (
        read(p) for p in (
            "core/video-cutting/worker-proxy.js", "core/video-cutting/worker-entry.js",
            "worker/wrangler.toml"
        )
    )
    for value in (
        'VIDEO_CUTTING_ENABLED', 'VIDEO_CUTTING_API_TOKEN', 'VIDEO_CUTTING_ACCESS_TOKEN',
        'url.protocol !== "https:"', 'video_content_type_required', 'x-filename',
        'FormData', 'form.append("file"', 'method: upload ? "POST" : "GET"',
        'MAX_UPLOAD_BYTES', 'cappedBody(request.body, MAX_UPLOAD_BYTES)'
    ):
        assert value in proxy
    assert 'handleVideoCuttingProxy(request, env)' in worker
    assert 'content-type,authorization' in worker
    assert 'main = "../core/video-cutting/worker-entry.js"' in wrangler
