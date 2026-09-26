import json, os, urllib.request, pathlib
request=pathlib.Path('automation/REQUEST.md').read_text(encoding='utf-8')
policy=pathlib.Path('config/autonomous_policy.json').read_text(encoding='utf-8')
prompt = """You are Mosharrof SAFE AUTONOMOUS ENGINE.
If there is no actionable PENDING request, output exactly NO_ACTION.
Otherwise output a unified git diff only.
Never delete files. Never modify .github/workflows, policies/CORE_POLICY.md, or config/policy.json.
Only modify web/, src/, tests/, config/, docs/, automation/.
Never add secrets, tokens, destructive commands, force pushes, or scope escapes.
Keep changes focused on the request.
REQUEST QUEUE:
{request}
POLICY:
{policy}
"""
data={"contents":[{"parts":[{"text":prompt.format(request=request,policy=policy)}]}]}
url="https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+os.environ["GEMINI_API_KEY"]
req=urllib.request.Request(url,data=json.dumps(data).encode(),headers={"content-type":"application/json"},method="POST")
with urllib.request.urlopen(req,timeout=90) as r: out=json.load(r)["candidates"][0]["content"]["parts"][0].get("text","").strip()
pathlib.Path("/tmp/mosharrof.patch").write_text(out,encoding="utf-8")
print(out[:4000])
