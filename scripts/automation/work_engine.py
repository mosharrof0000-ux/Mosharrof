#!/usr/bin/env python3
"""Create machine-readable, durable work-start/work-finish records for MOSHARROF automation."""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
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


def github_api_json(url: str, token: str) -> dict[str, Any] | None:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}",
                 "X-GitHub-Api-Version": "2022-11-28"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return payload if isinstance(payload, dict) else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None


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
    changed_files: list[str] = []
    for commit_item in event.get("commits", []) or []:
        for key in ("added", "modified", "removed"):
            changed_files.extend(str(path) for path in commit_item.get(key, []) or [])
    changed_files = sorted(set(changed_files))
    checked_runs: list[dict[str, Any]] = []
    token = env.get("GH_TOKEN") or env.get("GITHUB_TOKEN")
    api_root = f"https://api.github.com/repos/{env.get('GITHUB_REPOSITORY', '')}"
    if token and event_name == "workflow_run" and workflow_run.get("id"):
        jobs_payload = github_api_json(
            f"{api_root}/actions/runs/{workflow_run['id']}/jobs?per_page=100", token
        ) or {}
        for job in jobs_payload.get("jobs", []) or []:
            checked_runs.append({
                "job": job.get("name", "unknown"),
                "status": job.get("status", "unknown"),
                "conclusion": job.get("conclusion"),
                "steps": [
                    {"name": step.get("name", "unknown"), "conclusion": step.get("conclusion")}
                    for step in (job.get("steps", []) or [])
                ],
            })
    elif token and head_sha != "unknown":
        checks_payload = github_api_json(
            f"{api_root}/commits/{head_sha}/check-runs?per_page=100", token
        ) or {}
        for check in checks_payload.get("check_runs", []) or []:
            checked_runs.append({
                "job": check.get("name", "unknown"),
                "status": check.get("status", "unknown"),
                "conclusion": check.get("conclusion"),
                "steps": [],
            })

    if event_name == "workflow_run":
        completed_name = workflow_run.get("name", "unknown workflow")
        conclusion = workflow_run.get("conclusion") or "unknown"
        checked = [f"Completed workflow result: {completed_name} = {conclusion}",
                   f"Source commit: {head_sha}"]
        checked.extend(
            f"Job: {item['job']} — {item['status']}/{item['conclusion'] or 'pending'}"
            for item in checked_runs
        )
        planned = ["Record the completed workflow result, job-level checks and evidence URL.",
                   "Preserve the branch/SHA and determine whether a retry or follow-up is needed."]
        failed_jobs = [item["job"] for item in checked_runs if item.get("conclusion") not in (None, "success", "skipped", "neutral")]
        if conclusion != "success":
            first_failed = failed_jobs[0] if failed_jobs else completed_name
            next_step = f"Resume at failed workflow/job: {first_failed}. Open the linked run logs, fix on a safe feature branch, then rerun."
        elif failed_jobs:
            next_step = f"Inspect failed job {failed_jobs[0]} despite the workflow-level result; verify logs before proceeding."
        else:
            next_step = "Workflow passed. Inspect its artifacts and then continue from the project's first pending checkpoint item."
    elif event_name == "push":
        commit = (event.get("head_commit") or {})
        message = commit.get("message", "commit message unavailable").splitlines()[0]
        checked = [f"Push commit: {message}", f"Commit SHA: {head_sha}"]
        if changed_files:
            checked.append("Changed paths: " + ", ".join(changed_files))
        checked.extend(
            f"Check: {item['job']} — {item['status']}/{item['conclusion'] or 'pending'}"
            for item in checked_runs
        )
        planned = ["Record the commit message, changed paths and available checks.",
                   "Run the work-engine contract tests and validate the run metadata.",
                   "Publish a durable log entry and a machine-readable latest state."]
        failed_checks = [item["job"] for item in checked_runs if item.get("conclusion") not in (None, "success", "skipped", "neutral")]
        pending_checks = [item["job"] for item in checked_runs if item.get("status") != "completed"]
        if failed_checks:
            next_step = f"Resume at failed check: {failed_checks[0]}. Open its run logs and repair on a safe feature branch."
        elif pending_checks:
            next_step = f"Wait for pending checks ({', '.join(pending_checks[:5])}); then inspect their results and artifacts."
        else:
            next_step = "Review the checks attached to this commit and continue from the project's first pending checkpoint item."
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
        "changed_files": changed_files,
        "check_results": checked_runs,
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
            "- Changed paths:",
            *([f"  - {item}" for item in details.get("changed_files", [])] or ["  - No changed paths were provided by this event."]),
            "- Available check results:",
            *([f"  - {item.get('job')}: {item.get('status')}/{item.get('conclusion') or 'pending'}" for item in details.get("check_results", [])] or ["  - No check results were available at start."]),
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
        missing_start_state = not bool(previous.get("timestamp_utc"))
        if missing_start_state:
            # The start step may have failed before writing a state file. Preserve an explicit
            # recovery record rather than silently producing a success-shaped empty state.
            previous = {
                **details,
                "timestamp_utc": utc_now(),
                "phase": "STARTED_RECOVERY",
                "status": "interrupted",
                "next_step": "Resume from the last durable gate checkpoint and inspect the failed start/checkpoint step.",
            }
        result = {
            **previous,
            "timestamp_utc": previous.get("timestamp_utc", finished_at),
            "finished_at_utc": finished_at,
            "phase": "FINISHED",
            "status": status,
            "outcome": "success" if status == "success" else ("failure" if status == "failure" else status),
        }
        if status != "success" and missing_start_state:
            result["next_step"] = "Resume from the last durable gate checkpoint and inspect the failed start/checkpoint step."
        elif status != "success":
            result["next_step"] = "Inspect this work-engine run's logs, fix its first failure on a safe feature branch, and rerun focused checks."
        elif previous.get("event_name") == "workflow_run" and previous.get("source_conclusion") != "success":
            result["next_step"] = previous.get("next_step", "Inspect the failed source workflow logs and resume at its first failed job.")
        elif previous.get("event_name") == "workflow_run":
            result["next_step"] = "Inspect the source workflow artifacts and continue from the project's first pending checkpoint item; do not infer physical-device acceptance."
        else:
            result["next_step"] = previous.get("next_step", "Review this SHA's checks and continue from the first pending checkpoint item.")
        lines = [
            f"## FINISHED — {result.get('workflow', 'MOSHARROF Automatic Work Engine')}",
            f"- Time (UTC): {finished_at}",
            f"- Result: **{status.upper()}**",
            f"- Branch/SHA: `{result.get('branch', 'unknown')}` / `{result.get('sha', 'unknown')}`",
            f"- Run: {result.get('run_url', 'unknown')}",
            "- What was checked/detected:",
            *[f"  - {item}" for item in result.get("checked", [])],
            "- Changed paths:",
            *([f"  - {item}" for item in result.get("changed_files", [])] or ["  - No changed-path list was provided by this event."]),
            "- Job/check results:",
            *([f"  - {item.get('job')}: {item.get('status')}/{item.get('conclusion') or 'pending'}" for item in result.get("check_results", [])] or ["  - No API check details were available for this event."]),
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
