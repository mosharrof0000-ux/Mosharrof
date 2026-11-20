from pathlib import Path

def test_screenshot_worker_contract():
    s = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "export default" in s
    assert "GEMINI_API_KEY" in s
    assert "image_base64" in s
    assert "generateContent" in s
    assert "/generate-image" in s
    assert "gemini-nano-banana-2.1" in s
    assert "cloudflare-workers-ai" in s
    assert "@cf/black-forest-labs/flux-1-schnell" in s
    assert "IMAGE_PROVIDER_ORDER" in s
    assert "free_image_providers" in s
    assert "<html" not in s.lower()


def test_screenshot_worker_security_and_cors_guardrails():
    s = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "function isAllowedOrigin" in s
    assert "function withRequestCors" in s
    assert "TRUSTED_APP_ORIGINS" in s
    assert "origin_not_allowed" in s


def test_browser_client_never_stores_screenshot_api_keys():
    for rel_path in ("web/index.html", "web/app.js", "web/sidebar-recovery.js"):
        path = Path(rel_path)
        if path.is_file():
            content = path.read_text(encoding="utf-8")
