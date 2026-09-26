def test_screenshot_worker_contract():
    from pathlib import Path
    s=Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "export default" in s
    assert "GEMINI_API_KEY" in s
    assert "image_base64" in s
    assert "generateContent" in s
    assert "<html" not in s.lower()
