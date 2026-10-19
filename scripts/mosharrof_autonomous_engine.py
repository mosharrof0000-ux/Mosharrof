#!/usr/bin/env python3
"""Guarded Mosharrof autonomous implementation engine."""
import json, os, re, subprocess, time, urllib.request, urllib.error
from pathlib import Path

repo = os.environ["REPOSITORY"]
request_file = Path(os.environ.get("REQUEST_FILE", "/tmp/request.txt"))
if request_file.is_file():
    request = request_file.read_text(encoding="utf-8").strip()
else:
    request = os.environ.get("REQUEST", "").strip()
if not request:
    request = "Conservative scheduled Mosharrof audit: identify a clear, safe, testable improvement; if none is justified, make no change."

# Verify registered entities before any autonomous reasoning.
subprocess.run(["python3", "scripts/entity_awareness.py"], check=True)
key = os.environ.get("GEMINI_API_KEY", "").strip()
model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash").strip()
run_id = os.environ.get("GITHUB_RUN_ID", "local")

# Gemini is preferred, but an invalid or unavailable Gemini credential must not
# prevent configured alternate providers from completing the guarded planning step.

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

base = "https://generativelanguage.googleapis.com/v1beta"
TRANSIENT_HTTP_CODES = {429, 500, 502, 503, 504}

def request_model(model_name, attempts=4):
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
    }).encode()
    last_error = None
    for attempt in range(attempts):
        req = urllib.request.Request(
            f"{base}/models/{model_name}:generateContent",
            data=payload,
            headers={"Content-Type": "application/json", "x-goog-api-key": key},
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            if exc.code == 404:
                return None
            last_error = f"HTTP {exc.code}: {detail}"
            if exc.code not in TRANSIENT_HTTP_CODES:
                raise RuntimeError(f"Gemini request failed ({last_error})") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            delay = min(2 ** (attempt + 1), 8)
            print(f"Gemini temporarily unavailable for {model_name}; retry {attempt + 2}/{attempts} in {delay}s.")
            time.sleep(delay)
    raise RuntimeError(f"Gemini model {model_name} remained unavailable after {attempts} attempts ({last_error}).")

last_error = None
data = None
if key:
    try:
        data = request_model(model)
    except RuntimeError as exc:
        data = None
        last_error = str(exc)
else:
    print("Gemini key is not configured; trying alternate providers.")

if data is None and key and not any(marker in (last_error or "") for marker in ("HTTP 400", "HTTP 401", "HTTP 403", "API_KEY_INVALID")):
    req = urllib.request.Request(f"{base}/models", headers={"x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            catalog = json.load(response)
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        # Model discovery may fail independently of generateContent. Keep
        # trying known Flash IDs instead of stopping after a transient 503.
        print(f"Gemini model catalog unavailable ({type(exc).__name__}); trying the safe fallback list.")
        catalog = {"models": []}
    available = [
        item.get("name", "").removeprefix("models/")
        for item in catalog.get("models", [])
        if "generateContent" in item.get("supportedGenerationMethods", [])
    ]
    candidates = sorted(
        (name for name in available if name and "flash" in name.lower() and name != model),
        key=lambda name: (("preview" in name.lower()), name),
    )
    fallback_models = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
    for fallback in fallback_models:
        if fallback != model and fallback not in candidates:
            candidates.append(fallback)
    if not candidates:
        detail = f" Preferred model error: {last_error}" if last_error else ""
        raise SystemExit("No alternative Gemini Flash model supporting generateContent is available." + detail)
    for candidate in candidates:
        try:
            data = request_model(candidate)
            if data is not None:
                model = candidate
                print(f"Gemini fallback model selected from API-supported model list: {model}")
                break
        except RuntimeError as exc:
            last_error = str(exc)
            print(f"Gemini fallback {candidate} unavailable; trying the next supported model.")
def request_openai_compatible(provider, endpoint, api_key, models, extra_headers=None):
    """Try compatible chat-completions routes without logging credentials or response bodies."""
    if not api_key or not endpoint:
        return None
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    headers.update(extra_headers or {})
    for model_name in models:
        payload = json.dumps({
            "model": model_name,
            "messages": [
                {"role": "system", "content": "Return exactly one valid JSON object matching the requested schema. Do not use Markdown fences."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
        }).encode()
        req = urllib.request.Request(endpoint, data=payload, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=150) as response:
                result = json.load(response)
            text = result["choices"][0]["message"]["content"]
            if isinstance(text, str) and text.strip():
                print(f"Alternate provider selected: {provider} ({model_name}).")
                return text.strip()
            print(f"{provider} returned an empty response for {model_name}; trying next model.")
        except urllib.error.HTTPError as exc:
            print(f"{provider} fallback model {model_name} unavailable (HTTP {exc.code}); trying next model/provider.")
        except (urllib.error.URLError, TimeoutError, KeyError, IndexError, TypeError, ValueError) as exc:
            print(f"{provider} fallback model {model_name} failed ({type(exc).__name__}); trying next model/provider.")
    return None


def request_alternate_provider():
    """Free-first fallback chain: Cloudflare Workers AI, Groq, then OpenRouter."""
    cf_token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    cf_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if cf_token and cf_account:
        endpoint = f"https://api.cloudflare.com/client/v4/accounts/{cf_account}/ai/v1/chat/completions"
        text = request_openai_compatible(
            "Cloudflare Workers AI", endpoint, cf_token,
            ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"],
        )
        if text:
            return text

    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        text = request_openai_compatible(
            "Groq", "https://api.groq.com/openai/v1/chat/completions", groq_key,
            ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"],
        )
        if text:
            return text

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if openrouter_key:
        text = request_openai_compatible(
            "OpenRouter", "https://openrouter.ai/api/v1/chat/completions", openrouter_key,
            ["openai/gpt-oss-20b:free", "meta-llama/llama-3.3-70b-instruct:free"],
            {"HTTP-Referer": "https://mosharrof0000-ux.github.io/Mosharrof/", "X-Title": "MOSHARROF Autonomous Engine"},
        )
        if text:
            return text
    return None


provider_text = None
if data is None:
    if last_error:
        print(f"Gemini unavailable ({last_error[:180]}); trying configured alternate providers.")
    provider_text = request_alternate_provider()
if data is None and provider_text is None:
    raise SystemExit(last_error or "No configured AI provider accepted the guarded planning request.")

try:
    if provider_text is not None:
        proposal = json.loads(provider_text)
    else:
        proposal = json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
    raise SystemExit(f"AI provider returned an invalid structured plan: {exc}")
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

subprocess.run(["python3", "scripts/mosharrof_vitality.py"], check=True)
subprocess.run(["python3", "-m", "pytest", "-q"], check=True)

Path("artifacts/visual").mkdir(parents=True, exist_ok=True)
server = subprocess.Popen(
    ["python3", "-m", "http.server", "4173", "--directory", "web"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
)
try:
    subprocess.run(["node", "scripts/mosharrof_visual_qa.mjs", "http://127.0.0.1:4173"], check=True)
finally:
    server.terminate()
subprocess.run(["python3", "scripts/entity_awareness.py"], check=True)

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
subprocess.run(["gh", "pr", "merge", branch, "--auto", "--squash"], check=True)
print(f"PR created and auto-merge requested: {branch}")
