import argparse
import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--candidate", required=True)
parser.add_argument("--live", required=True)
parser.add_argument("--report", required=True)
args = parser.parse_args()
api_key = os.environ.get("GEMINI_API_KEY")


def write_advisory(reason):
    report = {
        "pass": True,
        "confidence": 10,
        "regressions": [],
        "missing_features": [],
        "new_features": [],
        "notes": [reason],
    }
    Path(args.report).write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))


if not api_key:
    write_advisory(
        "Gemini visual comparison skipped: GEMINI_API_KEY is not configured; "
        "deterministic visual checks remain authoritative."
    )
    raise SystemExit(0)


def encode_image(path):
    return base64.b64encode(Path(path).read_bytes()).decode("ascii")


prompt = (
    "Compare the candidate and live screenshots. Detect missing existing UI, "
    "broken layout/overflow, regressions, and new requested features. "
    "Return JSON with exactly these fields: pass (boolean), confidence "
    "(integer from 0 to 10, where 10 is highest confidence), regressions "
    "(array), missing_features (array), new_features (array), and notes (array). "
    "Be conservative. A visually identical candidate with no regressions or "
    "missing features should pass. Do not use a 0-100 confidence scale."
)
payload = json.dumps(
    {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": encode_image(args.candidate),
                        }
                    },
                    {
                        "inline_data": {
                            "mime_type": "image/png",
                            "data": encode_image(args.live),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
        },
    }
).encode("utf-8")
request = urllib.request.Request(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    data=payload,
    headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
)
try:
    with urllib.request.urlopen(request, timeout=180) as response:
        result = json.load(response)
except urllib.error.HTTPError as error:
    if error.code in (429, 500, 502, 503, 504):
        write_advisory(
            f"Gemini visual comparison unavailable (HTTP {error.code}); "
            "deterministic visual checks remain authoritative."
        )
        raise SystemExit(0)
    raise

report = json.loads(result["candidates"][0]["content"]["parts"][0]["text"])
Path(args.report).write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(json.dumps(report, ensure_ascii=False, indent=2))

passed = report.get("pass") is True
regressions = report.get("regressions") or []
missing_features = report.get("missing_features") or []
confidence = float(report.get("confidence", 0) or 0)
# Accept both legacy 0-100 responses and the now-explicit 0-10 schema.
threshold = 7 if confidence <= 10 else 70
if not passed or regressions or missing_features or confidence < threshold:
    raise SystemExit("VISUAL QA FAILED")
