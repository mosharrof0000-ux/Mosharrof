#!/usr/bin/env python3
"""Guarded autonomous patcher with Gemini model discovery and safe fallback."""
import json, os, subprocess, pathlib, requests

task=pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").strip()
if not task:
    raise SystemExit("No task supplied; refusing to generate an empty autonomous patch.")

allowed=("web/","src/","tests/","docs/","config/","entities/")
protected={"CODEOWNERS"}
snapshot=[]
for p in pathlib.Path(".").rglob("*"):
    if p.is_file() and ".git" not in p.parts and p.stat().st_size<120000:
        rel=p.as_posix()
        if rel.startswith(allowed):
            try: snapshot.append({"path":rel,"content":p.read_text(encoding="utf-8")})
            except (UnicodeDecodeError, OSError): pass
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

key=os.environ.get("GEMINI_API_KEY","").strip()
if not key:
    raise SystemExit("GEMINI_API_KEY is not configured.")

base="https://generativelanguage.googleapis.com/v1beta"
preferred=os.environ.get("GEMINI_MODEL","gemini-3.6-flash").strip()
models=[preferred]
def generate(model):
    return requests.post(
        f"{base}/models/{model}:generateContent",
        params={"key":key},
        json={"contents":[{"parts":[{"text":prompt}]}],
              "generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}},
        timeout=120,
    )

response=generate(preferred)
if response.status_code==404:
    catalog=requests.get(f"{base}/models",params={"key":key},timeout=30)
    catalog.raise_for_status()
    available=[]
    for item in catalog.json().get("models",[]):
        name=item.get("name","").removeprefix("models/")
        if name and "generateContent" in item.get("supportedGenerationMethods",[]):
            available.append(name)
    alternatives=sorted(
        (name for name in available if "flash" in name.lower() and name!=preferred),
        key=lambda name: (("preview" in name.lower()), name),
    )
    if preferred in available:
        alternatives.insert(0,preferred)
    if not alternatives:
        raise SystemExit("Gemini API key has no listed model supporting generateContent.")
    errors=[]
    for model in alternatives:
        response=generate(model)
        if response.ok:
            print("Gemini model selected from API-supported model list: "+model)
            break
        errors.append(f"{model}: HTTP {response.status_code}")
        if response.status_code not in (400,404):
            break
    else:
        raise SystemExit("No listed Gemini model accepted the request. "+", ".join(errors))
response.raise_for_status()
try:
    plan=json.loads(response.json()["candidates"][0]["content"]["parts"][0]["text"])
except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
    raise SystemExit(f"Gemini returned an invalid structured plan: {exc}")

changed=[]
for item in plan.get("files",[]):
    path=item["path"]; content=item["content"]
    if path in protected or path.startswith(".github/") or path.startswith(".git/") or path.startswith("/") or ".." in pathlib.PurePosixPath(path).parts or not path.startswith(allowed):
        raise SystemExit("Path outside autonomous allowlist: "+path)
    if not isinstance(content,str):
        raise SystemExit("Non-text content blocked for "+path)
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
