import base64,json,os,sys,urllib.request
key=os.environ.get("GEMINI_API_KEY")
if not key: raise SystemExit("GEMINI_API_KEY repository secret is required.")
prompt="Inspect these Mosharrof screenshots as visual QA. Check mobile layout, header/status readability, floating borderless chat, top/bottom fade, overlaps, clipping, missing content and regressions. Compare screenshots if two exist. Do not invent defects. Return JSON only: status PASS/FAIL, summary, regressions, observations, confidence."
parts=[{"text":prompt}]
for f in sys.argv[1:]:
    with open(f,"rb") as h: data=base64.b64encode(h.read()).decode()
    parts.append({"inlineData":{"mimeType":"image/png","data":data}})
payload=json.dumps({"contents":[{"parts":parts}]}).encode()
req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
with urllib.request.urlopen(req,timeout=180) as r: response=json.load(r)
t=response["candidates"][0]["content"]["parts"][0]["text"].strip()
if t.startswith("```"): t=t.split("\n",1)[1].rsplit("\n",1)[0]
report=json.loads(t)
with open("visual-audit-report.json","w",encoding="utf-8") as f: json.dump(report,f,ensure_ascii=False,indent=2)
print(json.dumps(report,ensure_ascii=False))
if report.get("status")!="PASS": raise SystemExit("Visual QA failed.")