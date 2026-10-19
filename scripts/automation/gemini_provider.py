"""Resilient Gemini content generation for the scheduled maintenance agent."""
import json
import time
import urllib.request
from urllib.error import HTTPError, URLError

_TRANSIENT = (429, 500, 502, 503, 504)
_FALLBACKS = ("gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash",
              "gemini-2.5-flash", "gemini-2.0-flash")


def generate_content(prompt, key, preferred_model, opener=None, sleeper=None):
    """Retry transient errors and try fallback models; never log credentials."""
    opener = opener or urllib.request.urlopen
    sleeper = sleeper or time.sleep
    models = list(dict.fromkeys((preferred_model, *_FALLBACKS)))
    errors = []
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}}
    for model in models:
        last_error = "unknown provider error"
        for attempt in range(3):
            req = urllib.request.Request(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                data=json.dumps(body).encode(),
                headers={"Content-Type": "application/json", "x-goog-api-key": key})
            try:
                with opener(req, timeout=120) as response:
                    print("Gemini model selected: " + model)
                    return json.loads(response.read())
            except HTTPError as exc:
                if exc.code not in _TRANSIENT:
                    raise
                last_error = f"HTTP {exc.code}"
            except (URLError, TimeoutError) as exc:
                last_error = type(exc).__name__
            if attempt < 2:
                delay = min(2 ** attempt, 4)
                print(f"Gemini temporarily unavailable for {model} ({last_error}); retrying in {delay}s.")
                sleeper(delay)
        errors.append(f"{model}: {last_error}")
        print(f"Gemini model {model} unavailable; trying the next fallback.")
    raise RuntimeError("No configured Gemini fallback accepted the request. " + "; ".join(errors))
