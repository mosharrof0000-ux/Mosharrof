def test_screenshot_worker_contract():
    from pathlib import Path
    p = Path("worker/screenshot-analysis.js")
    s = p.read_text()
    assert "GEMINI_API_KEY" in s
    assert "image_base64" in s
    assert "mime_type" in s
    assert "generateContent" in s
    assert "export default" in s
    assert "<html" not in s.lower()
