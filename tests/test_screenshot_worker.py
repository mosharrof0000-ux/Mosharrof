def test_screenshot_worker_contract():
    from pathlib import Path
    s=Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "export default" in s
    assert "GEMINI_API_KEY" in s
    assert "image_base64" in s
    assert "generateContent" in s
    assert "gemini-3.8-flash" in s
    assert "gemini-2.0-flash" not in s
    assert "gemini-1.5-flash" not in s
    assert "<html" not in s.lower()
