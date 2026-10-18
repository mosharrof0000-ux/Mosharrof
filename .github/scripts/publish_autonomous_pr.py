#!/usr/bin/env python3
"""Publish a guarded autonomous patch as a draft PR after the source workflow passes."""
import os
import subprocess
import sys


def run(args, *, check=False):
    result = subprocess.run(args, text=True, capture_output=True, check=False)
    if check and result.returncode:
        raise SystemExit(result.stderr.strip() or f"Command failed: {args[0]}")
    return result


repo = os.environ.get("GH_REPO", "").strip()
token = os.environ.get("GH_TOKEN", "").strip()
run_id = os.environ.get("GITHUB_RUN_ID", "").strip()
if not repo or not token:
    raise SystemExit("GH_REPO/GH_TOKEN missing; cannot safely publish autonomous PR.")

branch = run(["git", "branch", "--show-current"], check=True).stdout.strip()
if not branch.startswith("agent/autonomous-"):
    print("No autonomous patch branch; nothing to publish.")
    sys.exit(0)

existing = run(["gh", "pr", "view", branch, "--repo", repo])
if existing.returncode == 0:
    print(f"Reviewable PR already exists for {branch}.")
    sys.exit(0)

changed = run(["git", "diff", "--name-only", "origin/main...HEAD"], check=True).stdout.strip()
if not changed:
    print("No diff from main; nothing to publish.")
    sys.exit(0)

title = run(["git", "log", "-1", "--pretty=%s"], check=True).stdout.strip()
body = (
    "## Autonomous recovery patch\n\n"
    f"- Source run: https://github.com/{repo}/actions/runs/{run_id}\n"
    f"- Branch: `{branch}`\n"
    "- Baseline tests, full verification, and protected-change checks passed before PR creation.\n"
    "- This is a draft PR for review; the worker never auto-merges or deploys it.\n\n"
    "## Changed paths\n\n"
    "```\n" + changed + "\n```\n"
)
created = run([
    "gh", "pr", "create", "--repo", repo, "--base", "main", "--head", branch,
    "--title", title or "feat: autonomous verified Mosharrof improvement",
    "--body", body, "--draft",
])
if created.returncode:
    raise SystemExit(created.stderr.strip() or "Draft PR creation failed.")
print(created.stdout.strip())
