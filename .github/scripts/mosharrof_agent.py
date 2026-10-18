#!/usr/bin/env python3
"""Guarded autonomous patcher with Gemini model discovery and safe fallback."""
import json, os, sys, subprocess, pathlib, requests, time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
from scripts.automation.autonomous_patch_quality import is_trivial_rewrite

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
TRANSIENT_HTTP_CODES={429,500,502,503,504}

def generate(model, attempts=3):
    """Retry transient Gemini responses/network errors without exposing the API key."""
    last_error=None
    for attempt in range(attempts):
        try:
            response=requests.post(
                f"{base}/models/{model}:generateContent",
                params={"key":key},
                json={"contents":[{"parts":[{"text":prompt}]}],
                      "generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}},
                timeout=120,
            )
        except requests.RequestException as exc:
            last_error=type(exc).__name__
            retry=True
            response=None
        else:
            if response.ok or response.status_code==404:
                return response
            if response.status_code not in TRANSIENT_HTTP_CODES:
                return response
            last_error=f"HTTP {response.status_code}"
            retry=True
        if attempt < attempts-1:
            delay=min(2 ** attempt,4)
            print(f"Gemini temporarily unavailable for {model} ({last_error}); retrying in {delay}s.")
            time.sleep(delay)
    print(f"Gemini model {model} still unavailable after {attempts} attempts ({last_error}); checking supported alternatives.")
    return response

response=generate(preferred)
if response is None or response.status_code==404 or response.status_code in TRANSIENT_HTTP_CODES:
    try:
        catalog=requests.get(f"{base}/models",params={"key":key},timeout=30)
        catalog.raise_for_status()
        available=[]
        for item in catalog.json().get("models",[]):
            name=item.get("name","").removeprefix("models/")
            if name and "generateContent" in item.get("supportedGenerationMethods",[]):
                available.append(name)
    except (requests.RequestException, ValueError) as exc:
        code=getattr(getattr(exc,"response",None),"status_code",None)
        detail=f"HTTP {code}" if code else type(exc).__name__
        print(f"Gemini model catalog unavailable ({detail}); trying the safe fallback list.")
        available=[]

    alternatives=sorted(
        (name for name in available if "flash" in name.lower() and name!=preferred),
        key=lambda name: (("preview" in name.lower()),name),
    )
    fallback_models=["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-2.5-flash","gemini-2.0-flash"]
    for fallback in fallback_models:
        if fallback!=preferred and fallback not in alternatives:
            alternatives.append(fallback)
    if not alternatives:
        raise SystemExit("No alternative Gemini Flash model supporting generateContent is available.")
    errors=[]
    for model in alternatives:
        candidate=generate(model)
        if candidate is not None and candidate.ok:
            response=candidate
            print("Gemini fallback model selected from API-supported model list: "+model)
            break
        status=f"HTTP {candidate.status_code}" if candidate is not None else "network error"
        errors.append(f"{model}: {status}")
        print(f"Gemini fallback {model} unavailable; trying the next supported model.")
    else:
        raise SystemExit("No listed Gemini Flash model accepted the request. "+", ".join(errors))

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
    target=pathlib.Path(path)
    if target.exists():
        try:
            current=target.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError) as exc:
            raise SystemExit(f"Unable to safely inspect existing file {path}: {type(exc).__name__}")
        if is_trivial_rewrite(current,content):
            print("IGNORED_TRIVIAL_CHANGE "+path)
            continue
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(content,encoding="utf-8")
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
