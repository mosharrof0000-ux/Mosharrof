import base64, json, os, urllib.request
from pathlib import Path

key=os.environ.get("GEMINI_API_KEY")
if not key: raise SystemExit("GEMINI_API_KEY missing")

def img(name):
    return base64.b64encode(Path("visual-qa",name).read_bytes()).decode()

prompt="""Act as Mosharrof's visual QA engineer.
Inspect the supplied candidate screenshot and live screenshot.
Check:
1. Is the design intact?
2. Did anything disappear?
3. Did anything new appear unexpectedly?
4. Are header/status-bar/composer controls readable?
5. Is text hidden behind controls incorrectly?
6. Is spacing, overflow, clipping, alignment or responsive behavior broken?
7. Does the candidate preserve the intended floating-text visual design?
Return JSON only:
{"status":"PASS or FAIL","issues":[],"preserved":[],"new_or_missing":[],"summary":"..."}
Do not approve a change merely because it looks attractive. Compare it against the live screenshot and report concrete differences."""

parts=[{"text":prompt}]
for name,label in [("live.png","LIVE"),("candidate.png","CANDIDATE"),("diff.png","DIFF")]:
    parts.append({"text":label})
    parts.append({"inlineData":{"mimeType":"image/png","data":img(name)}})

payload=json.dumps({"contents":[{"parts":parts}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request(
 "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
 data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
with urllib.request.urlopen(req,timeout=180) as r:
    data=json.load(r)
text=data["candidates"][0]["content"]["parts"][0]["text"]
Path("visual-qa/ai-review.json").write_text(text,encoding="utf-8")
review=json.loads(text)
print(json.dumps(review,ensure_ascii=False,indent=2))
if review.get("status")!="PASS":
    raise SystemExit("AI visual QA failed")
