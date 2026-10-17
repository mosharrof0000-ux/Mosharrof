#!/usr/bin/env python3
"""Create machine-readable, durable work-start/work-finish records for MOSHARROF automation."""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_event() -> dict[str, Any]:
    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if event_path and Path(event_path).is_file():
        try:
            return json.loads(Path(event_path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
    return {}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def event_details(event_name: str, event: dict[str, Any], env: dict[str, str]) -> dict[str, Any]:
    workflow_run = event.get("workflow_run") or {}
    pr = event.get("pull_request") or {}
    head_branch = (
        workflow_run.get("head_branch")
        or pr.get("head", {}).get("ref")
        or env.get("GITHUB_REF_NAME")
        or "unknown"
    )
    head_sha = (
        workflow_run.get("head_sha")
        or pr.get("head", {}).get("sha")
        or env.get("GITHUB_SHA")
        or "unknown"
    )
    run_id = str(workflow_run.get("id") or env.get("GITHUB_RUN_ID", "unknown"))
    run_url = workflow_run.get("html_url") or (
        f"{env.get('GITHUB_SERVER_URL', 'https://github.com')}/"
        f"{env.get('GITHUB_REPOSITORY', 'unknown')}/actions/runs/{run_id}"
    )
    if event_name == "workflow_run":
        completed_name = workflow_run.get("name", "unknown workflow")
        conclusion = workflow_run.get("conclusion") or "unknown"
        checked = [f"Completed workflow result: {completed_name} = {conclusion}",
                   f"Source commit: {head_sha}"]
        planned = ["Record the completed workflow result and evidence URL.",
                   "Preserve the branch/SHA and determine whether a retry or follow-up is needed."]
        next_step = "Inspect the workflow logs and artifacts; fix failures on a safe feature branch."
    elif event_name == "push":
        commit = (event.get("head_commit") or {})
        message = commit.get("message", "commit message unavailable").splitlines()[0]
        checked = [f"Push commit: {message}", f"Commit SHA: {head_sha}"]
        planned = ["Record the change that started this automation run.",
                   "Run the work-engine contract tests and validate the run metadata.",
                   "Publish a durable log entry and a machine-readable latest state."]
        next_step = "Review the checks attached to this commit; continue from the first failed or pending check."
    elif event_name == "pull_request":
        checked = [f"Pull request #{pr.get('number', 'unknown')}: {pr.get('title', 'unknown')}",
                   f"PR head SHA: {head_sha}"]
        planned = ["Validate the work-engine script and event schema.",
                   "Record the PR event without changing the PR head or production branch."]
        next_step = "Review required checks on the current PR head before promotion."
    else:
        checked = [f"Event: {event_name}", f"Source SHA: {head_sha}"]
        planned = ["Validate automation metadata and contract tests.",
                   "Record start, result, and next-resume instructions."]
        next_step = "Review the run summary and continue from the first pending task."

    return {
        "timestamp_utc": utc_now(),
        "event_name": event_name,
        "workflow": env.get("GITHUB_WORKFLOW", "unknown"),
        "run_id": run_id,
        "run_url": run_url,
        "repository": env.get("GITHUB_REPOSITORY", "unknown"),
        "branch": head_branch,
        "sha": head_sha,
        "checked": checked,
        "planned": planned,
        "next_step": next_step,
        "source_workflow": workflow_run.get("name"),
        "source_conclusion": workflow_run.get("conclusion"),
    }


def write_summary(path: str | None, text: str) -> None:
    if path:
        with open(path, "a", encoding="utf-8") as stream:
            stream.write(text + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("start", "finish"), required=True)
    parser.add_argument("--out-dir", default=os.environ.get("RUNNER_TEMP", "/tmp") + "/mosharrof-work-engine")
    parser.add_argument("--job-status", default=os.environ.get("ENGINE_JOB_STATUS", "unknown"))
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    event_name = os.environ.get("GITHUB_EVENT_NAME", "local")
    details = event_details(event_name, load_event(), dict(os.environ))
    log_path = out_dir / "entry.md"
    state_path = out_dir / "state.json"
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")

    if args.phase == "start":
        details["phase"] = "STARTED"
        details["status"] = "in_progress"
        lines = [
            f"## STARTED — {details['workflow']}",
            f"- Time (UTC): {details['timestamp_utc']}",
            f"- Event: {event_name}",
            f"- Branch: `{details['branch']}`",
            f"- SHA: `{details['sha']}`",
            f"- Run: {details['run_url']}",
            "- Checked before work:",
            *[f"  - {item}" for item in details["checked"]],
            "- Planned work:",
            *[f"  - {item}" for item in details["planned"]],
            "- Current state: in progress; no success claim is made at start.",
            "",
        ]
        log_path.write_text("\n".join(lines), encoding="utf-8")
        state_path.write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_summary(summary_path, "\n".join(lines))
    else:
        previous = {}
        if state_path.is_file():
            try:
                previous = json.loads(state_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                previous = {}
        status = args.job_status
        finished_at = utc_now()
        result = {
            **previous,
            "finished_at_utc": finished_at,
            "phase": "FINISHED",
            "status": status,
            "outcome": "success" if status == "success" else ("failure" if status == "failure" else status),
        }
        result["next_step"] = (
            "Review artifacts and required checks for this exact SHA; do not infer device acceptance from build success."
            if status == "success"
            else "Inspect this run's logs, fix the first failure on a safe feature branch, and rerun focused checks."
        )
        lines = [
            f"## FINISHED — {result.get('workflow', 'MOSHARROF Automatic Work Engine')}",
            f"- Time (UTC): {finished_at}",
            f"- Result: **{status.upper()}**",
            f"- Branch/SHA: `{result.get('branch', 'unknown')}` / `{result.get('sha', 'unknown')}`",
            f"- Run: {result.get('run_url', 'unknown')}",
            f"- Next resume point: {result['next_step']}",
            "",
        ]
        with log_path.open("a", encoding="utf-8") as stream:
            stream.write("\n".join(lines) + "\n")
        state_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        write_summary(summary_path, "\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
