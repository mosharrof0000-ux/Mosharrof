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
