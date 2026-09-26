import base64,json,os,sys,urllib.request
key=os.environ.get("GEMINI_API_KEY")
if not key: raise SystemExit("GEMINI_API_KEY is required for AI visual review.")
def img(p): return {"inlineData":{"mimeType":"image/png","data":base64.b64encode(open(p,"rb").read()).decode()}}
prompt="""You are Mosharrof Visual Design Guardian. Compare baseline, proposed, and current-live screenshots.
Check: header/status readability; no rectangular chat cards; floating text and top/bottom fade; safe-area/notch; usable composer/buttons; no overlap/cutoff; existing navigation; requested additions visible; live has not unexpectedly changed.
Return JSON only: {"decision":"PASS" or "FAIL","issues":[],"missing":[],"summary":"..."}.
FAIL only for a concrete regression or missing feature."""
payload=json.dumps({"contents":[{"parts":[{"text":prompt},img(sys.argv[1]),img(sys.argv[2]),img(sys.argv[3])]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
with urllib.request.urlopen(req,timeout=180) as r: data=json.load(r)
result=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
print(json.dumps(result,ensure_ascii=False,indent=2))
if result.get("decision")!="PASS": raise SystemExit("AI VISUAL REVIEW: FAIL")
