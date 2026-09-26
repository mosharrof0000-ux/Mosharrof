#!/usr/bin/env python3
import os,sys,json,subprocess,pathlib,requests

task=pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
allowed=("web/","src/","tests/","docs/","config/","entities/")
protected={".github/workflows/deploy-pages.yml",".github/workflows/verification-gate.yml","CODEOWNERS"}
snapshot=[]
for p in pathlib.Path(".").rglob("*"):
    if p.is_file() and ".git" not in p.parts and p.stat().st_size<120000:
        rel=p.as_posix()
        if rel.startswith(allowed):
            try: snapshot.append({"path":rel,"content":p.read_text(encoding="utf-8")})
            except: pass
snapshot=snapshot[:120]
prompt="""You are the Mosharrof autonomous engineering agent.
Task:
%s

Rules:
- Never delete files.
- Never modify .github/workflows/*, CODEOWNERS, or repository settings.
- Never add credentials, tokens, secrets, trackers, or destructive commands.
- Prefer minimal, testable changes.
- If unsafe, ambiguous, or not justified, return no changes.
Return STRICT JSON:
{"summary":"...","files":[{"path":"relative/path","content":"complete file content"}]}
REPOSITORY SNAPSHOT:
%s
"""%(task[:12000],json.dumps(snapshot,ensure_ascii=False))
r=requests.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",params={"key":os.environ["GEMINI_API_KEY"]},json={"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}},timeout=120)
r.raise_for_status()
plan=json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
changed=[]
for item in plan.get("files",[]):
    path=item["path"]; content=item["content"]
    if path in protected or path.startswith(".github/") or path.startswith(".git/") or path.startswith("/") or ".." in pathlib.PurePosixPath(path).parts or not path.startswith(allowed):
        raise SystemExit("Path outside autonomous allowlist: "+path)
    pathlib.Path(path).parent.mkdir(parents=True,exist_ok=True)
    pathlib.Path(path).write_text(content,encoding="utf-8")
    changed.append(path)
if not changed:
    print("NO_SAFE_CHANGE")
    sys.exit(0)
subprocess.run(["git","config","user.name","Mosharrof Autonomous Agent"],check=True)
subprocess.run(["git","config","user.email","41898282+github-actions[bot]@users.noreply.github.com"],check=True)
subprocess.run(["git","checkout","-b","agent/autonomous-"+str(os.getpid())],check=True)
subprocess.run(["git","add","--"]+changed,check=True)
subprocess.run(["git","diff","--cached","--check"],check=True)
subprocess.run(["git","commit","-m","feat: autonomous verified Mosharrof improvement"],check=True)
subprocess.run(["git","push","--set-upstream","origin",subprocess.check_output(["git","branch","--show-current"],text=True).strip()],check=True)
print(plan.get("summary","Autonomous improvement"))
