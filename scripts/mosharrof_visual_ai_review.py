import base64, json, os, pathlib, urllib.request
key=os.environ["GEMINI_API_KEY"]
parts=[{"text":"""Inspect these Mosharrof screenshots as a strict visual QA reviewer.
Check mobile/desktop layout, responsiveness, header/status-bar clarity, floating text, top/bottom fade,
fixed controls, overlap, clipping, missing elements, and obvious regressions.
Return JSON only: {"pass":true/false,"issues":[],"evidence":[],"severity":"none|low|medium|high"}.
PASS only when there is no medium/high visual defect."""}]
for name in ["mobile.png","desktop.png","mobile-after-2s.png","desktop-after-2s.png"]:
    data=base64.b64encode(pathlib.Path("artifacts/visual",name).read_bytes()).decode()
    parts.append({"inline_data":{"mime_type":"image/png","data":data}})
payload=json.dumps({"contents":[{"parts":parts}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
with urllib.request.urlopen(req,timeout=180) as r: result=json.load(r)
review=json.loads(result["candidates"][0]["content"]["parts"][0]["text"])
pathlib.Path("artifacts/visual/ai-review.json").write_text(json.dumps(review,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(review,ensure_ascii=False,indent=2))
if not review.get("pass"): raise SystemExit("AI visual review failed")
