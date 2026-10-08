def test_screenshot_worker_contract():
    from pathlib import Path
    s=Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
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
