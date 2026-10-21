#!/usr/bin/env python3
"""Research failed CI signatures across public developer issue trackers and search engines.

The tool only publishes redacted error signatures, never full logs or credentials.
It creates a research report; it does not apply patches or deploy code.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SECRET_PATTERNS = [
    re.compile(r"(?i)(authorization\s*[:=]\s*bearer\s+)\S+"),
    re.compile(r"(?i)(api[_-]?key|token|password|secret|client_secret)(\s*[:=]\s*)[^\s,;]+"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{20,}"),
    re.compile(r"(?i)AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"(?i)(cloudflare_api_token|gemini_api_key)\s*[:=]\s*[^\s,;]+"),
]
ERROR_HINTS = re.compile(
    r"(?i)(error|failed|failure|exception|timed? ?out|timeout|broken pipe|"
    r"can't find service|cannot find service|device offline|unknown \(-1\)|"
    r"HTTP 4\d\d|HTTP 5\d\d|status code|traceback|not responding|"
    r"no such file|permission denied|connection refused|websocket|adb:)"
)
NOISE = re.compile(r"(?i)(^\s*at \S+\(|^\s*#\d+|downloaded [0-9]+ bytes|^\s*progress:)")

def redact(value: str) -> str:
    value = html.unescape(value)
    for pattern in SECRET_PATTERNS:
        value = pattern.sub(lambda m: (m.group(1) if m.lastindex else "") + "[REDACTED]", value)
    value = re.sub(r"https?://[^/\s:@]+:[^/@\s]+@", "https://[REDACTED]@", value)
    value = re.sub(r"(?i)([?&](?:api[_-]?key|access[_-]?token|auth|token|password|secret|key)=)[^&\\s]+", r"\\1[REDACTED]", value)
    value = re.sub(r"(?i)(cookie|set-cookie)\s*[:=]\s*[^\n]+", r"\1: [REDACTED]", value)
    return value[:500].strip()

def signatures(log_text: str, limit: int = 8) -> list[str]:
    found: list[str] = []
    for raw in log_text.splitlines():
        line = raw.strip()
        if not line or not ERROR_HINTS.search(line) or NOISE.search(line):
            continue
        clean = redact(line)
        clean = re.sub(r"\x1b\[[0-9;]*m", "", clean)
        clean = re.sub(r"\s+", " ", clean)
        if clean and clean not in found:
            found.append(clean)
        if len(found) >= limit:
            break
    if not found:
        found.append("CI workflow failed; inspect the linked run for the first failing step")
    return found

def get_json(url: str, token: str | None = None) -> dict[str, Any] | None:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "MOSHARROF-failure-research/1.0"}
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as response:
            obj = json.loads(response.read().decode("utf-8", "replace"))
            return obj if isinstance(obj, dict) else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None

def search_sources(signature: str, token: str | None) -> dict[str, Any]:
    query = signature[:180]
    encoded = urllib.parse.quote(query)
    links = {
        "Google": "https://www.google.com/search?q=" + encoded,
        "Bing": "https://www.bing.com/search?q=" + encoded,
        "DuckDuckGo": "https://html.duckduckgo.com/html/?q=" + encoded,
        "Brave Search": "https://search.brave.com/search?q=" + encoded,
        "GitHub Issues": "https://github.com/search?q=" + encoded + "&type=issues",
        "Stack Overflow": "https://stackoverflow.com/search?q=" + encoded,
    }
    gh_url = "https://api.github.com/search/issues?q=" + urllib.parse.quote(query + " is:issue")
    gh = get_json(gh_url, token)
    gh_items = []
    for item in (gh or {}).get("items", [])[:5]:
        gh_items.append({"title": item.get("title", "Untitled"), "url": item.get("html_url", ""),
                         "state": item.get("state", "unknown"), "repository": (item.get("repository_url", "").split("/repos/")[-1])})
    so_url = "https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&site=stackoverflow&pagesize=5&q=" + encoded
    so = get_json(so_url)
    so_items = []
    for item in (so or {}).get("items", [])[:5]:
        so_items.append({"title": html.unescape(item.get("title", "Untitled")), "url": item.get("link", ""),
                         "score": item.get("score", 0), "is_answered": item.get("is_answered", False)})
    return {"signature": query, "search_links": links, "github_issues": gh_items,
            "stackoverflow": so_items, "github_api_available": gh is not None,
            "stackoverflow_api_available": so is not None}

def build_report(log_text: str, run_url: str, run_name: str, token: str | None = None) -> str:
    items = signatures(log_text)
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    sections = [
        "# MOSHARROF Automatic Failure Research",
        "",
        f"- Created (UTC): {now}",
        f"- Failed run: {run_url or 'not supplied'}",
        f"- Workflow: {redact(run_name or 'unknown')}",
        "- Safety: logs are not attached; only short redacted error signatures are searched.",
        "- Scope: this report researches likely prior incidents; matching results are leads, not proof of root cause.",
        "",
    ]
    for i, sig in enumerate(items, 1):
        result = search_sources(sig, token)
        sections += [f"## Finding {i}: `{sig}`", "", "### Search-engine links"]
        sections += [f"- [{name}]({url})" for name, url in result["search_links"].items()]
        sections += ["", "### Matching GitHub issues"]
        if result["github_issues"]:
            sections += [f"- [{x['title']}]({x['url']}) — {x['repository']} ({x['state']})" for x in result["github_issues"]]
        else:
            sections.append("- No matching GitHub issues were returned by the API (or the API was unavailable).")
        sections += ["", "### Matching Stack Overflow posts"]
        if result["stackoverflow"]:
            sections += [f"- [{x['title']}]({x['url']}) — score {x['score']}; answered={x['is_answered']}" for x in result["stackoverflow"]]
        else:
            sections.append("- No matching Stack Overflow posts were returned by the API (or the API was unavailable).")
        sections += ["", "### Next action", "Compare any candidate solution against the exact failing step and environment, apply one isolated change on a feature branch, rerun focused tests, and retain before/after evidence. Do not merge or deploy based on search results alone.", ""]
    return "\n".join(sections) + "\n"

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to failed-run log text")
    parser.add_argument("--output", required=True, help="Markdown report destination")
    parser.add_argument("--run-url", default="")
    parser.add_argument("--run-name", default="")
    args = parser.parse_args()
    try:
        log_text = Path(args.input).read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        print(f"Unable to read input log: {exc}", file=sys.stderr)
        return 2
    report = build_report(log_text, args.run_url, args.run_name, os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN"))
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(report, encoding="utf-8")
    print(f"Failure research report written: {args.output}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
