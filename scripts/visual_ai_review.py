import base64,json,os,sys,urllib.request
from pathlib import Path

key=os.environ.get("GEMINI_API_KEY")
if not key:
    print("AI visual review skipped: GEMINI_API_KEY is not configured.")
    raise SystemExit(0)

folder=Path("test-results")
images=sorted(folder.glob("candidate-*.png"))
parts=[{"text":"You are Mosharrof's visual QA engineer. Review these browser screenshots from the proposed UI. Check whether existing design structure is preserved and whether there are visible regressions: missing header/menu/search/profile, broken chat layout, rectangular message cards, clipped text, overlap, bad mobile sizing, missing composer, missing top/bottom fade, or unusable controls. Intended color/style changes are not failures. Return JSON only: {"verdict":"PASS" or "FAIL","summary":"...","issues":["..."]}"}]
for p in images:
    parts.append({"text":"CANDIDATE "+p.name})
    parts.append({"inlineData":{"mimeType":"image/png","data":base64.b64encode(p.read_bytes()).decode()}})

payload=json.dumps({"contents":[{"parts":parts}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    data=payload,
    headers={"Content-Type":"application/json","x-goog-api-key":key}
)
with urllib.request.urlopen(req,timeout=180) as r:
    result=json.load(r)
text=result["candidates"][0]["content"]["parts"][0]["text"]
print(text)
Path("test-results/ai-visual-review.json").write_text(text,encoding="utf-8")
review=json.loads(text)
if review.get("verdict")!="PASS":
    raise SystemExit("AI VISUAL REVIEW FAILED")
