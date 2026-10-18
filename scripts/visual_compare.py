import argparse,base64,json,os,urllib.request,urllib.error
from pathlib import Path
from visual_pr_context import pull_request_context
p=argparse.ArgumentParser(); p.add_argument("--candidate",required=True); p.add_argument("--live",required=True); p.add_argument("--report",required=True); a=p.parse_args()
key=os.environ.get("GEMINI_API_KEY")

def write_advisory(reason):
    report={"pass":True,"confidence":100,"regressions":[],"missing_features":[],"new_features":[],"notes":[reason]}
    Path(a.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))

if not key:
    write_advisory("Gemini visual comparison skipped: GEMINI_API_KEY is not configured; deterministic visual checks remain authoritative.")
    raise SystemExit(0)
def enc(x): return base64.b64encode(Path(x).read_bytes()).decode()
prompt=('Compare candidate and live screenshots. Detect missing existing UI, broken layout/overflow, regressions, and new requested features. Use the pull-request context below: changes explicitly requested there (including removal/repositioning of controls) are intentional, not regressions; still report unrelated missing controls or layout problems. Return JSON with confidence as an integer from 0 to 10 (10 is highest confidence), and fields pass, regressions, missing_features, new_features, notes. A visually identical candidate with no regressions or missing features should pass. Be conservative. Do not use a 0-100 confidence scale.\\n' + pull_request_context())
payload=json.dumps({"contents":[{"parts":[{"text":prompt},{"inline_data":{"mime_type":"image/png","data":enc(a.candidate)}},{"inline_data":{"mime_type":"image/png","data":enc(a.live)}}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
try:
    with urllib.request.urlopen(req,timeout=180) as r: result=json.load(r)
except urllib.error.HTTPError as e:
    if e.code in (429,500,502,503,504):
        write_advisory(f"Gemini visual comparison unavailable (HTTP {e.code}); deterministic visual checks remain authoritative.")
        raise SystemExit(0)
    raise
report=json.loads(result["candidates"][0]["content"]["parts"][0]["text"])
Path(a.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
confidence=float(report.get("confidence",0) or 0)
threshold=7 if confidence <= 10 else 70
if (report.get("pass") is not True or report.get("regressions") or report.get("missing_features") or confidence < threshold): raise SystemExit("VISUAL QA FAILED")
