import base64,json,os,urllib.request
from pathlib import Path
key=os.environ["GEMINI_API_KEY"]
b64=base64.b64encode(Path("visual-qa/mobile-current.png").read_bytes()).decode()
prompt="""You are Mosharrof's visual QA inspector. Inspect this current web-app screenshot.
Check for: blank/broken page; missing header/chat/composer; accidental rectangular message cards; content hidden behind header/composer; overlap; clipping; overflow; missing controls; severe contrast/layout breakage. FAIL only for concrete visible breakage or missing required UI, not subjective taste.
Return JSON only: {"status":"PASS|FAIL","issues":["..."],"confidence":0.0}"""
payload=json.dumps({"contents":[{"parts":[{"text":prompt},{"inline_data":{"mime_type":"image/png","data":b64}}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
with urllib.request.urlopen(req,timeout=120) as r: result=json.load(r)
report=json.loads(result["candidates"][0]["content"]["parts"][0]["text"])
Path("visual-qa/gemini-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
if report.get("status")!="PASS": raise SystemExit("AI Visual QA FAILED: "+"; ".join(report.get("issues",[])))
