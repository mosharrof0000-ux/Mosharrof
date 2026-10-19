import json
from io import BytesIO
from urllib.error import HTTPError

from scripts.automation.gemini_provider import generate_content


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self):
        return json.dumps(self.payload).encode()


def test_provider_retries_503_then_uses_fallback_model():
    attempts = []
    def opener(request, timeout):
        attempts.append(request.full_url)
        if "gemini-3.8-flash" in request.full_url:
            raise HTTPError(request.full_url, 503, "busy", None, BytesIO(b""))
        return FakeResponse({"candidates": [{"content": {"parts": [{"text": "{\"summary\":\"ok\",\"patch\":\"\"}"}]}}]})

    result = generate_content("test", "fake-key", "gemini-3.8-flash", opener=opener, sleeper=lambda _: None)
    assert len(attempts) == 4
    assert "gemini-3.6-flash" in attempts[-1]
    assert result["candidates"][0]["content"]["parts"][0]["text"].startswith("{")


def test_six_hour_workflow_uses_existing_token_fallback_and_no_cancel():
    from pathlib import Path
    workflow = Path(".github/workflows/mosharrof-autonomous-6h.yml").read_text(encoding="utf-8")
    assert "secrets.MOSHARROF_RECOVERY_TOKEN || github.token" in workflow
    assert "contents: write" in workflow
    assert "pull-requests: write" in workflow
    assert "cancel-in-progress: false" in workflow
