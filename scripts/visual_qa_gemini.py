import base64, json, os, sys, urllib.request

key=os.environ.get("GEMINI_API_KEY")
if not key:
    raise SystemExit("GEMINI_API_KEY secret is required for AI visual QA.")

def b64(path):
    return base64.b64encode(open(path,"rb").read()).decode()

main_img=b64(sys.argv[1])
proposed_img=b64(sys.argv[2])

prompt="""You are Mosharrof's visual QA engineer.
Compare the BASE screenshot (current main) and PROPOSED screenshot (PR).
Check:
1. Does the proposed design render correctly on a 390x844 mobile viewport?
2. Are header/status controls readable and not covered?
3. Does content remain visible behind/under the intended glass/fade layers without breaking readability?
4. Is the chat text still present and not converted into rectangular message cards?
5. Is the composer visible and usable?
6. Are there obvious clipping, overflow, broken layout, missing controls, or regressions?
7. Did the proposed change preserve important existing UI unless the PR intentionally changes it?
Do not reject merely because the visual design changed; distinguish intended changes from defects.

Return JSON only:
{"decision":"PASS or FAIL","issues":["..."],"summary":"...","confidence":0.0}
"""

payload=json.dumps({"contents":[{"parts":[
 {"text":prompt},
 {"inlineData":{"mimeType":"image/png","data":main_img}},
 {"inlineData":{"mimeType":"image/png","data":proposed_img}}
]}],"generationConfig":{"temperature":0.0,"responseMimeType":"application/json"}}).encode()

req=urllib.request.Request(
 "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
 data=payload,
 headers={"Content-Type":"application/json","x-goog-api-key":key},
)
with urllib.request.urlopen(req,timeout=180) as r:
    data=json.load(r)
result=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
print(json.dumps(result,ensure_ascii=False,indent=2))
if result.get("decision")!="PASS":
    raise SystemExit("Visual QA FAILED: "+result.get("summary","unknown issue"))
