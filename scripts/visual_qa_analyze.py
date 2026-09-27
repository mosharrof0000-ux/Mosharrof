import os,json,base64,urllib.request
from pathlib import Path

# Deterministic visual gate: browser screenshots + DOM evidence must be valid.
layout=json.loads(Path("visual-qa/layout.json").read_text())
issues=[]
if layout.get("horizontalOverflow"): issues.append({"severity":"major","description":"Mobile page has horizontal overflow."})
selectors=layout.get("selectors",{})
for s in ("header",".messages",".composer"):
    if not selectors.get(s): issues.append({"severity":"major","description":f"Required selector missing: {s}"})
for n in ("mobile","desktop"):
    p=Path(f"visual-qa/current-{n}.png")
    if not p.exists() or p.stat().st_size < 10000: issues.append({"severity":"major","description":f"Invalid or missing {n} screenshot."})

result={"status":"FAIL" if any(i["severity"]=="major" for i in issues) else "PASS","issues":issues,"summary":"Deterministic browser visual QA completed."}

# Optional Gemini review. It is advisory and never turns a healthy deterministic gate red.
k=os.environ.get("GEMINI_API_KEY","").strip()
if k:
    try:
        parts=[{"text":"Inspect these Mosharrof screenshots for obvious visual regressions. Return JSON only: {\"status\":\"PASS|FAIL|REVIEW\",\"issues\":[],\"summary\":\"...\"}. This is advisory; do not fail the workflow."}]
        for n in ("mobile","desktop"):
            parts.append({"inline_data":{"mime_type":"image/png","data":base64.b64encode(Path(f"visual-qa/current-{n}.png").read_bytes()).decode()}})
        payload=json.dumps({"contents":[{"parts":parts}],"generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}}).encode()
        req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=payload,headers={"Content-Type":"application/json","x-goog-api-key":k})
        with urllib.request.urlopen(req,timeout=180) as r: data=json.load(r)
        result["ai_review"]=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
    except Exception as e:
        result["ai_review"]={"status":"REVIEW","issues":[],"summary":"Optional AI visual review unavailable; deterministic visual gate remains authoritative."}

Path("visual-qa/analysis.json").write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
if result["status"]=="FAIL": raise SystemExit("Deterministic Visual QA failed")
