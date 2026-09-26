import os,json,base64,urllib.request
from pathlib import Path
k=os.environ.get("GEMINI_API_KEY")
if not k: raise SystemExit("GEMINI_API_KEY required")
parts=[{"text":"You are Mosharrof Visual QA Inspector. Inspect the real browser screenshots and DOM. Check mobile/desktop layout, missing/broken UI, clipping/overflow, header/status visibility, floating text without rectangular cards, top/bottom fade, composer overlap, and obvious visual regressions. Do not invent. Return JSON only: {\"status\":\"PASS|FAIL|REVIEW\",\"issues\":[{\"severity\":\"critical|major|minor\",\"description\":\"...\"}],\"summary\":\"...\"}. DOM: "+Path("visual-qa/layout.json").read_text()}]
for n in ["mobile","desktop"]: parts.append({"inline_data":{"mime_type":"image/png","data":base64.b64encode(Path("visual-qa/current-"+n+".png").read_bytes()).decode()}})
payload=json.dumps({"contents":[{"parts":parts}],"generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=payload,headers={"Content-Type":"application/json","x-goog-api-key":k})
with urllib.request.urlopen(req,timeout=180) as r:d=json.load(r)
result=json.loads(d["candidates"][0]["content"]["parts"][0]["text"])
Path("visual-qa/analysis.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)); print(json.dumps(result,ensure_ascii=False,indent=2))
if result.get("status")=="FAIL": raise SystemExit("Visual QA failed")