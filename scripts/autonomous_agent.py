#!/usr/bin/env python3
import json, os, pathlib, subprocess, urllib.request

ROOT=pathlib.Path(".").resolve()
MODEL=os.getenv("GEMINI_MODEL") or "gemini-3.8-flash"
KEY=os.environ["GEMINI_API_KEY"]
REPO=os.environ["GH_REPO"]
TOKEN=os.environ["AGENT_ACCESS_TOKEN"]
REQUEST=os.getenv("AUTONOMOUS_REQUEST","").strip()
ALLOWED=("web/","src/","backend/","tests/","config/","docs/")

def run(*a,env=None): return subprocess.check_output(a,text=True,env=env).strip()

files=[]
for p in ROOT.rglob("*"):
    if not p.is_file() or ".git" in p.parts: continue
    rel=p.relative_to(ROOT).as_posix()
    if rel.startswith(".github/") or p.stat().st_size>180000: continue
    try: data=p.read_text(encoding="utf-8")
    except Exception: continue
    files.append(f"===== {rel} =====\n{data[:8000]}")
snapshot="\n".join(files[:200])

prompt=f"""You are Mosharrof's bounded autonomous maintenance agent.
Request: {REQUEST or 'Inspect the project and make one concrete safe improvement.'}
Rules: never delete; never touch .github/, CODEOWNERS, secrets, deployment policy; only modify {ALLOWED}; never put API keys in browser code; keep patch <=500 lines; return JSON {{summary, patch}} where patch is a unified git diff.
Snapshot:
{snapshot}"""
body={"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"responseMimeType":"application/json","temperature":0.1}}
req=urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",data=json.dumps(body).encode(),headers={"Content-Type":"application/json","x-goog-api-key":KEY})
with urllib.request.urlopen(req,timeout=120) as r: out=json.loads(r.read())
data=json.loads(out["candidates"][0]["content"]["parts"][0]["text"])
patch=data.get("patch",""); summary=data.get("summary","Autonomous improvement")
if not patch.strip(): print("NO_ACTION"); raise SystemExit(0)
if "deleted file mode" in patch or ".github/" in patch or "CODEOWNERS" in patch: raise SystemExit("REFUSED protected/deletion patch")
paths=[x[6:] for x in patch.splitlines() if x.startswith("+++ b/")]
if any(not p.startswith(ALLOWED) for p in paths): raise SystemExit("REFUSED path")
if len(patch.splitlines())>500: raise SystemExit("REFUSED patch too large")
pathlib.Path("/tmp/mosharrof.patch").write_text(patch,encoding="utf-8")
subprocess.run(["git","apply","--check","/tmp/mosharrof.patch"],check=True)
subprocess.run(["git","apply","--index","/tmp/mosharrof.patch"],check=True)
subprocess.run(["python","-m","pytest","-q"],check=True)
branch="agent/autonomous-"+os.getenv("GITHUB_RUN_ID","manual")
subprocess.run(["git","config","user.name","Mosharrof Autonomous Agent"],check=True)
subprocess.run(["git","config","user.email","41898282+github-actions[bot]@users.noreply.github.com"],check=True)
subprocess.run(["git","checkout","-b",branch],check=True)
subprocess.run(["git","add","-A"],check=True); subprocess.run(["git","commit","-m","Autonomous: verified improvement"],check=True)
env=os.environ.copy(); env["GH_TOKEN"]=TOKEN
subprocess.run(["git","remote","set-url","origin",f"https://x-access-token:{TOKEN}@github.com/{REPO}.git"],check=True)
subprocess.run(["git","push","--set-upstream","origin",branch],check=True,env=env)
subprocess.run(["gh","pr","create","--repo",REPO,"--base","main","--head",branch,"--title","Auto: verified Mosharrof improvement","--body",f"{summary}\n\nTests passed. Main was never edited directly."],check=True,env=env)
pr=run("gh","pr","list","--repo",REPO,"--head",branch,"--json","number","--jq",".[0].number",env=env)
subprocess.run(["gh","pr","merge",pr,"--repo",REPO,"--auto","--squash"],check=True,env=env)
print("PR",pr)