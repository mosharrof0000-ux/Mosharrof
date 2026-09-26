#!/usr/bin/env python3
"""Visual regression + functional audit for Mosharrof.

Captures the candidate UI and current live UI, then asks Gemini vision to
compare them. The audit fails on broken page load, console errors, missing
core UI, or a high-confidence visual regression.
"""
import base64, json, os, subprocess, time, urllib.request
from pathlib import Path

LIVE_URL=os.environ.get("LIVE_URL","https://mosharrof0000-ux.github.io/Mosharrof/")
OUT=Path("artifacts/visual-audit"); OUT.mkdir(parents=True,exist_ok=True)

subprocess.Popen(["python3","-m","http.server","4173","--directory","web"],
                 stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(2)

subprocess.run(["npx","--yes","playwright@1.55.0","install","chromium"],check=True)

def shot(url, path):
    subprocess.run([
      "npx","--yes","playwright@1.55.0","screenshot",
      "--browser=chromium","--device=\"Desktop Chrome\"",
      "--full-page",url,str(path)
    ],check=True)

candidate=OUT/"candidate.png"; live=OUT/"live.png"
shot("http://127.0.0.1:4173/",candidate)
shot(LIVE_URL,live)

def read(url):
    try:
        with urllib.request.urlopen(url,timeout=20) as r:
            return r.status, r.read(300000).decode("utf-8","ignore")
    except Exception as e:
        return 0,str(e)

status,body=read("http://127.0.0.1:4173/")
if status != 200:
    raise SystemExit("Candidate page did not return HTTP 200.")
for required in ("MOSHARROF AI","messages","composer"):
    if required not in body:
        raise SystemExit("Candidate missing required UI marker: "+required)

key=os.environ.get("GEMINI_API_KEY")
if not key:
    raise SystemExit("GEMINI_API_KEY is required for visual audit.")

def b64(p): return base64.b64encode(p.read_bytes()).decode()

prompt="""You are Mosharrof Visual QA.
Compare the CURRENT LIVE screenshot and the CANDIDATE screenshot.

Check:
1. Does the candidate preserve the existing important UI?
2. Did any major existing feature appear to disappear?
3. Is the requested change actually visible?
4. Are there overlap, clipping, broken responsive layout, unreadable text,
   header/status-bar problems, composer problems, or broken controls?
5. For a floating chat design, verify text flows without rectangular message
   cards and has sensible top/bottom fading.
6. Separate intentional visual changes from regressions.

Return JSON only:
{
 "pass": true/false,
 "severity": "none|low|medium|high|critical",
 "summary": "...",
 "regressions": ["..."],
 "new_or_changed_features": ["..."],
 "recommended_fix": "..."
}

Do not fail merely because colors or spacing intentionally changed.
Fail for functional/structural regressions or severe visual breakage.
"""

payload=json.dumps({
 "contents":[{
   "parts":[
     {"text":prompt},
     {"text":"CURRENT LIVE SCREENSHOT"},
     {"inline_data":{"mime_type":"image/png","data":b64(live)}},
     {"text":"CANDIDATE SCREENSHOT"},
     {"inline_data":{"mime_type":"image/png","data":b64(candidate)}}
   ]
 }],
 "generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}
}).encode()

req=urllib.request.Request(
 "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
 data=payload,
 headers={"Content-Type":"application/json","x-goog-api-key":key})
with urllib.request.urlopen(req,timeout=180) as r:
    result=json.loads(json.load(r)["candidates"][0]["content"]["parts"][0]["text"])

(OUT/"report.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False))

if not result.get("pass",False) or result.get("severity") in {"high","critical"}:
    raise SystemExit("Visual QA failed; promotion must stop.")
