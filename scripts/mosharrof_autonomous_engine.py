#!/usr/bin/env python3
"""Guarded Mosharrof autonomous implementation engine."""
import json, os, re, subprocess, urllib.request
from pathlib import Path

repo = os.environ["REPOSITORY"]
request_file = Path(os.environ.get("REQUEST_FILE", "/tmp/request.txt"))
request = request_file.read_text(encoding="utf-8").strip()
key = os.environ.get("GEMINI_API_KEY", "").strip()
model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash").strip()
run_id = os.environ.get("GITHUB_RUN_ID", "local")

# Component consciousness = operational awareness, not human consciousness.
# Load the registry first so every autonomous cycle knows the system organs,
# their responsibilities, and their declared health contracts.
registry_path = Path("config/autonomous_operation.json")
if not registry_path.exists():
    raise SystemExit("Component registry is missing.")
try:
    operation = json.loads(registry_path.read_text(encoding="utf-8"))
except json.JSONDecodeError as exc:
    raise SystemExit(f"Component registry is invalid JSON: {exc}")

components = operation.get("components", [])
if not isinstance(components, list) or not components:
    raise SystemExit("Component registry has no components.")

component_report = []
for component in components:
    cid = str(component.get("id", "")).strip()
    path_text = str(component.get("path", "")).strip()
    health = component.get("health", [])
    if not cid or not path_text or not isinstance(health, list):
        raise SystemExit("Invalid component registry entry.")
    component_report.append(
        f"- {cid}: path={path_text}; role={component.get('role','')}; "
        f"health={'; '.join(map(str, health))}"
    )

if not request:
    raise SystemExit("No autonomous request supplied.")
if not key:
    raise SystemExit("GEMINI_API_KEY is required.")

blocked = re.compile(
    r"(rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|gh\s+repo\s+delete|delete[-_ ]repository|drop\s+database)",
    re.I,
)
allowed = ("web/", "tests/", "scripts/", "docs/", "README.md", "requirements.txt")
suffixes = {".html", ".css", ".js", ".mjs", ".py", ".yml", ".yaml", ".md", ".json"}

snapshot = []
for root in ("web", "tests", "scripts", "docs"):
    p = Path(root)
    if not p.exists():
        continue
    for f in sorted(p.rglob("*")):
        if f.is_file() and f.stat().st_size < 200000 and f.suffix.lower() in suffixes:
            snapshot.append(f"FILE: {f}\n" + f.read_text(encoding="utf-8", errors="ignore"))
for name in ("README.md", "requirements.txt"):
    p = Path(name)
    if p.exists():
        snapshot.append(f"FILE: {p}\n" + p.read_text(encoding="utf-8", errors="ignore"))

prompt = f"""You are the guarded Mosharrof software engineer.

Task:
{request}

Repository:
{repo}

Component registry:
{chr(10).join(component_report)}

Rules:
- Never delete anything.
- Never modify .github/workflows, secrets, permissions, branch protection, or deployment rules.
- Never force-push or directly target main.
- Preserve existing features.
- Make the smallest complete safe change.
- Return JSON only:
{{"summary":"...","files":[{{"path":"relative/path","content":"complete file content"}}]}}
- Allowed paths: web/, tests/, scripts/, docs/, README.md, requirements.txt.
- If no safe change is needed, return files: [].

Current snapshot:
{chr(10).join(snapshot)}
"""

payload = json.dumps({
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
}).encode()

req = urllib.request.Request(
    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    data=payload,
    headers={"Content-Type": "application/json", "x-goog-api-key": key},
)
with urllib.request.urlopen(req, timeout=180) as response:
    data = json.load(response)

proposal = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
changes = proposal.get("files", [])
if not isinstance(changes, list):
    raise SystemExit("Invalid agent response.")

if not changes:
    print("NO_CHANGE")
    raise SystemExit(0)

for item in changes:
    path_text = str(item.get("path", ""))
    path = Path(path_text)
    if not path_text or not path_text.startswith(allowed) or path.is_absolute() or ".." in path.parts or ".github" in path.parts:
        raise SystemExit(f"Blocked path: {path_text}")
    body = str(item.get("content", ""))
    if blocked.search(body):
        raise SystemExit(f"Blocked destructive content in {path_text}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")

subprocess.run(["python3", "-m", "pytest", "-q"], check=True)

# Re-check every registered component before promotion.
for component in components:
    path_text = str(component["path"])
    if not Path(path_text).exists():
        raise SystemExit(f"Component health failure: missing {path_text}")

Path("artifacts/visual").mkdir(parents=True, exist_ok=True)
subprocess.Popen(
    ["python3", "-m", "http.server", "4173", "--directory", "web"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
subprocess.run(["node", "scripts/mosharrof_visual_qa.mjs", "http://127.0.0.1:4173"], check=True)

slug = re.sub(r"[^a-z0-9-]+", "-", request.lower()).strip("-")[:48] or "task"
branch = f"agent/auto-{slug}-{run_id}"
subprocess.run(["git", "switch", "-c", branch], check=True)
subprocess.run(["git", "config", "user.name", "Mosharrof Autonomous Engine"], check=True)
subprocess.run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
subprocess.run(["git", "add", "--"] + [str(x["path"]) for x in changes], check=True)
subprocess.run(["git", "commit", "-m", "Auto: guarded Mosharrof task"], check=True)
subprocess.run(["git", "push", "--set-upstream", "origin", branch], check=True)

body = f"""Generated by the Mosharrof autonomous pipeline.

Task:
{request}

Pre-PR verification:
- pytest
- mobile visual QA
- desktop visual QA
- destructive-operation guard
- isolated branch only

Main remains protected. Promotion is through the protected PR path.
"""
subprocess.run([
    "gh", "pr", "create", "--base", "main", "--head", branch,
    "--title", "Auto: Mosharrof guarded task", "--body", body
], check=True)

# Hand promotion to GitHub's protected merge queue. GitHub evaluates required
# checks and branch protection; the engine never pushes directly to main.
subprocess.run(["gh", "pr", "merge", branch, "--auto", "--squash"], check=True)
print(f"PR created and auto-merge requested: {branch}")
