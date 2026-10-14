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


def test_video_generation_contract_is_server_side_and_fail_closed():
    from pathlib import Path
    s=Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert 'const VIDEO_MODEL="fal-ai/wan/v2.7/text-to-video"' in s
    assert "env.FAL_KEY" in s
    assert '"Authorization":"Key "+key' in s
    assert "duration:10" in s
    assert "video_provider_not_configured" in s
    assert '/generate-video' in s
    assert '/video-status' in s
