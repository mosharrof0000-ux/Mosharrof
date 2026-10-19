#!/usr/bin/env python3
"""Open an idempotent review-only PR for a fully verified autonomous patch."""
import json
import os
import subprocess
import sys


def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30, check=False)
    if result.returncode:
        detail = (result.stderr or result.stdout or "no diagnostic").strip()
        raise SystemExit(f"Command failed ({args[0]}): {detail[:1000]}")
    return result.stdout.strip()


repo = os.environ.get("GH_REPO", "").strip()
if not repo:
    raise SystemExit("GH_REPO is required.")
branch = run(["git", "branch", "--show-current"])
if not branch.startswith("agent/autonomous-"):
    print("No autonomous patch branch was created; no PR is needed.")
    sys.exit(0)
changed = run(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
if not changed:
    raise SystemExit("Autonomous branch has no committed file changes; refusing empty PR.")
changed_paths = {path.strip() for path in changed.splitlines() if path.strip()}
if changed_paths == {"docs/WORK_RESUME_CHECKPOINT.md"}:
    raise SystemExit(
        "Refusing a checkpoint-only autonomous PR; select a concrete implementation/test blocker "
        "or report why no safe code change is justified."
    )
existing_raw = run(["gh", "pr", "list", "--repo", repo, "--state", "open", "--head", branch, "--json", "number,url"])
try:
    existing = json.loads(existing_raw or "[]")
except json.JSONDecodeError as exc:
    raise SystemExit(f"Could not parse open-PR lookup: {exc}")
if existing:
    print(f"Open PR already exists for {branch}: {existing}")
    sys.exit(0)
run([
    "gh", "pr", "create", "--repo", repo, "--base", "main", "--head", branch,
    "--title", "Auto: verified Mosharrof autonomous improvement",
    "--body", (
        "Created by the guarded autonomous work cycle after baseline tests, full tests, "
        "and protected-change checks passed.\n\n"
        "Review-only: no automatic merge or deployment is performed.\n\n"
        f"Run: {os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/"
        f"{repo}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
    ),
])
print(f"Created review PR for {branch}.")
