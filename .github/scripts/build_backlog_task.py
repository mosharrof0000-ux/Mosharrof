#!/usr/bin/env python3
"""Build a bounded backlog task; never hide GitHub API/auth failures as an empty backlog."""
import json
import os
import subprocess
import time
from pathlib import Path

REPO = os.environ.get("GH_REPO", "mosharrof0000-ux/Mosharrof")
EVENT = os.environ.get("EVENT_NAME", "schedule")
MAX_TASK_CHARS = 12000


def gh_json(args, attempts=3):
    """Retry transient CLI/API errors and fail visibly rather than silently losing backlog data."""
    last_error = "unknown error"
    for attempt in range(attempts):
        try:
            result = subprocess.run(
                ["gh", *args, "--repo", REPO],
                capture_output=True, text=True, timeout=30, check=False,
            )
            if result.returncode == 0:
                try:
                    return json.loads(result.stdout or "[]")
                except json.JSONDecodeError as exc:
                    last_error = f"invalid JSON: {exc}"
            else:
                detail = (result.stderr or result.stdout or "no diagnostic").strip()
                last_error = f"gh exited {result.returncode}: {detail[:500]}"
        except (OSError, subprocess.TimeoutExpired) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        if attempt < attempts - 1:
            delay = 2 ** attempt
            print(f"GitHub backlog query failed ({last_error}); retrying in {delay}s.")
            time.sleep(delay)
    raise SystemExit(f"Cannot build a trustworthy backlog: {last_error}")


def bounded_json(items, limit=3600):
    """Keep complete JSON records within a prompt budget; never cut JSON mid-record."""
    if not isinstance(items, list):
        items = []
    kept = []
    for item in items:
        candidate = kept + [item]
        suffix = {"items": candidate, "truncated": len(items) - len(candidate)}
        if len(json.dumps(suffix, ensure_ascii=False)) > limit:
            break
        kept.append(item)
    return json.dumps(
        {"items": kept, "truncated": max(0, len(items) - len(kept))},
        ensure_ascii=False,
    )


if EVENT == "schedule":
    task = (
        "NIGHTLY BACKLOG DUTY for MOSHARROF. Work only on already-existing tasks and plans; do not invent new features. "
        "First triage open PRs, failed or still-running Actions, merge conflicts, and existing web/PWA plus Android chat verification. "
        "Prioritize red checks and stalled work, then the oldest mergeable backlog items. Inspect evidence, identify root causes, make the smallest safe patch only in the allowed source/test/docs paths, and run the full test suite. "
        "Never modify deployment/security workflows, bypass protection, merge PRs, or claim success without evidence. If a blocker needs unavailable permissions, physical-device access, or protected workflow changes, document it and continue to another safe task. "
        "Keep main/Live safe. Do not add unrelated features until existing backlog is cleared."
    )
elif EVENT == "workflow_dispatch":
    task = (
        "Manual MOSHARROF backlog recovery. Inspect existing PRs and failed/stalled workflows first; resolve the oldest safe blocker. "
        "No new feature scope, no direct main edits, no unsafe merge/deploy, and no success claims without test evidence."
    )
elif EVENT == "issues":
    task = "Existing user task:\n" + os.environ.get("ISSUE_TITLE", "") + "\n" + os.environ.get("ISSUE_BODY", "")
else:
    task = "Existing user task:\n" + os.environ.get("COMMENT_BODY", "")

if EVENT in ("schedule", "workflow_dispatch"):
    prs = gh_json(["pr", "list", "--state", "open", "--limit", "30", "--json",
                   "number,title,url,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision"])
    runs = gh_json(["run", "list", "--limit", "25", "--json",
                    "name,status,conclusion,createdAt,url,headBranch,event"])
    issues = gh_json(["issue", "list", "--state", "open", "--limit", "30", "--json",
                      "number,title,url,updatedAt,labels"])
    task += "\n\nOPEN PR BACKLOG (bounded complete JSON):\n" + bounded_json(prs, 3600)
    task += "\n\nRECENT ACTION RUNS (bounded complete JSON; inspect failed/in-progress first):\n" + bounded_json(runs, 3600)
    task += "\n\nOPEN ISSUE BACKLOG (bounded complete JSON):\n" + bounded_json(issues, 2400)

if len(task) > MAX_TASK_CHARS:
    task = task[:MAX_TASK_CHARS]
Path("/tmp/task.txt").write_text(task, encoding="utf-8")
print(f"Prepared {EVENT} task with {len(task)} characters.")
