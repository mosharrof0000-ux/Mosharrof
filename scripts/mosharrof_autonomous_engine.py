#!/usr/bin/env python3
"""Safe autonomous Mosharrof controller.
The model edits only an isolated branch. Promotion is done only through PR checks.
"""
import json, os, re, subprocess, urllib.request
from pathlib import Path

repo=os.environ["REPOSITORY"]
request=os.environ.get("REQUEST","").strip()
inbox=Path("AUTONOMOUS_TASKS.md")
if not request and inbox.exists():
    request=inbox.read_text(encoding="utf-8").strip()
if not request:
    print("No autonomous task is pending.")
    raise SystemExit(0)

key=os.environ.get("GEMINI_API_KEY")
if not key:
    raise SystemExit("GEMINI_API_KEY secret is required.")

files=[]
for p in Path(".").rglob("*"):
    if p.is_file() and ".git" not in p.parts and len(files)<180:
        if p.suffix.lower() in {".html",".css",".js",".py",".yml",".yaml",".md",".json"}:
            files.append(str(p))
project_map="\n".join(files)

prompt="""You are Mosharrof Autonomous Engineer.
Task:
%s

Repository: %s
Project files:
%s

Rules:
1. Work only on an isolated branch.
2. Never delete files, repositories, branches, secrets, or user data.
3. Do not change .github/workflows unless explicitly required.
4. Preserve existing functionality.
5. Implement the smallest complete safe change.
6. Add/update tests when appropriate.
7. Do not claim success unless tests pass.
8. Return JSON only:
{"summary":"...","files":[{"path":"...","content":"complete file content"}]}
""" % (request,repo,project_map)

payload=json.dumps({
    "contents":[{"parts":[{"text":prompt}]}],
    "generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}
}).encode()

req=urllib.request.Request(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    data=payload,
    headers={"Content-Type":"application/json","x-goog-api-key":key},
)
with urllib.request.urlopen(req,timeout=120) as r:
    data=json.load(r)

result=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
blocked=re.compile(r"(rm\s+-rf|git\s+push\s+--force|delete-repository|drop\s+database|gh\s+repo\s+delete)",re.I)

for item in result.get("files",[]):
    if blocked.search(item.get("content","")):
        raise SystemExit("Blocked: destructive operation detected.")
    path=Path(item["path"])
    if path.is_absolute() or ".." in path.parts or str(path).startswith(".git/"):
        raise SystemExit("Unsafe path: "+str(path))
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(item["content"],encoding="utf-8")

changed=[x["path"] for x in result.get("files",[])]
if not changed:
    raise SystemExit("Agent returned no file changes.")

subprocess.run(["python3","-m","pytest","-q"],check=True)
subprocess.run(["git","config","user.name","Mosharrof Autonomous Engine"],check=True)
subprocess.run(["git","config","user.email","41898282+github-actions[bot]@users.noreply.github.com"],check=True)
subprocess.run(["git","add","--"]+changed,check=True)
subprocess.run(["git","commit","-m","Auto autonomous task"],check=True)

slug=re.sub(r"[^a-z0-9-]+","-",request.lower())[:48].strip("-") or "task"
branch="agent/auto-"+slug+"-"+os.environ["GITHUB_RUN_ID"]
subprocess.run(["git","checkout","-b",branch],check=True)
subprocess.run(["git","push","--set-upstream","origin",branch],check=True)

body="Mosharrof Autonomous Engine task:\n\n"+request+"\n\nIsolated branch: "+branch+"\n\nThis PR must pass all required checks before promotion."
subprocess.run(["gh","pr","create","--base","main","--head",branch,
                "--title","Auto autonomous task","--body",body],check=True)
\n# Ask GitHub to merge automatically only after required branch-protection checks pass.\n# If auto-merge is disabled at repository level, this fails safely and leaves the PR open.\nsubprocess.run(["gh","pr","merge","--auto","--squash","--delete-branch",branch],check=False)\nprint("Autonomous task completed through isolated PR creation; auto-merge requested.")
