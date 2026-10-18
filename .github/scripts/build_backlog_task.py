#!/usr/bin/env python3
"""Build a bounded, trustworthy task for the scheduled MOSHARROF worker."""
import json
import os
from pathlib import Path

from automation_resilience import bounded_json, gh_json

REPO = os.environ.get("GH_REPO", "mosharrof0000-ux/Mosharrof")
EVENT = os.environ.get("EVENT_NAME", "schedule")

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
                   "number,title,url,headRefName,baseRefName,isDraft,mergeStateStatus,reviewDecision"], REPO)
    runs = gh_json(["run", "list", "--limit", "25", "--json",
                    "name,status,conclusion,createdAt,url,headBranch,event"], REPO)
    issues = gh_json(["issue", "list", "--state", "open", "--limit", "30", "--json",
                      "number,title,url,updatedAt,labels"], REPO)
    task += "\n\nOPEN PR BACKLOG (bounded complete JSON):\n" + bounded_json(prs, 3600)
    task += "\n\nRECENT ACTION RUNS (bounded complete JSON; inspect failed/in-progress first):\n" + bounded_json(runs, 3600)
    task += "\n\nOPEN ISSUE BACKLOG (bounded complete JSON):\n" + bounded_json(issues, 2400)

if len(task) > 12000:
    raise SystemExit(f"Backlog task exceeded the 12000-character safety limit ({len(task)}); refusing to truncate evidence.")
Path("/tmp/task.txt").write_text(task, encoding="utf-8")
print(f"Prepared {EVENT} task with {len(task)} characters.")
