#!/usr/bin/env python3
"""Crash-tolerant work gate: record entry, checkpoints, exits, and interruption causes."""
from __future__ import annotations
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

REASONS = {"quota_limit", "mobile_hang", "timeout", "session_crash", "cancelled", "runner_lost", "unknown"}

def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def read_state(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("action", choices=("enter", "checkpoint", "exit", "interrupt", "resume"))
    p.add_argument("--dir", default=os.environ.get("WORK_GATE_DIR", ".work-gate"))
    p.add_argument("--task", default=os.environ.get("WORK_GATE_TASK"))
    p.add_argument("--purpose", default=os.environ.get("WORK_GATE_PURPOSE"))
    p.add_argument("--step", default=os.environ.get("WORK_GATE_STEP", "not specified"))
    p.add_argument("--reason", choices=sorted(REASONS), default="unknown")
    p.add_argument("--details", default="")
    p.add_argument("--run-url", default=os.environ.get("GITHUB_SERVER_URL", "https://github.com") + "/" + os.environ.get("GITHUB_REPOSITORY", "unknown") + "/actions/runs/" + os.environ.get("GITHUB_RUN_ID", "local"))
    args = p.parse_args()
    root = Path(args.dir)
    root.mkdir(parents=True, exist_ok=True)
    state_path, events_path = root / "gate-state.json", root / "gate-events.jsonl"
    state = read_state(state_path)
    event = {
        "timestamp_utc": now(), "action": args.action,
        "task": args.task or state.get("task") or "unspecified task",
        "purpose": args.purpose or state.get("purpose") or "unspecified purpose",
        "step": args.step, "reason": args.reason if args.action == "interrupt" else None,
        "details": args.details, "run_url": args.run_url,
        "branch": os.environ.get("GITHUB_REF_NAME", "local"),
        "sha": os.environ.get("GITHUB_SHA", "unknown"),
    }
    if args.action == "enter":
        state = {**event, "status": "in_progress", "completed_steps": [], "interruption": None}
        state["resume_from"] = args.step
    elif args.action == "checkpoint":
        if not state:
            raise SystemExit("Cannot checkpoint: no gate state exists. Run 'enter' first.")
        done = list(state.get("completed_steps", []))
        if args.step not in done:
            done.append(args.step)
        state.update({"status": "in_progress", "last_checkpoint_utc": event["timestamp_utc"],
                      "last_completed_step": args.step, "completed_steps": done,
                      "resume_from": args.details or "the next uncompleted step"})
        state["details"] = args.details
    elif args.action == "exit":
        if not state:
            raise SystemExit("Cannot exit: no gate state exists. Run 'enter' first.")
        done = list(state.get("completed_steps", []))
        if args.step and args.step not in done:
            done.append(args.step)
        state.update({"status": "completed", "finished_at_utc": event["timestamp_utc"],
                      "last_completed_step": args.step, "completed_steps": done,
                      "resume_from": None, "exit_details": args.details})
    elif args.action == "interrupt":
        if not state:
            state = {**event, "completed_steps": []}
        state.update({"status": "interrupted", "interrupted_at_utc": event["timestamp_utc"],
                      "interruption": {"reason": args.reason, "details": args.details},
                      "resume_from": args.step or state.get("resume_from") or "inspect last checkpoint and first incomplete step"})
    elif args.action == "resume":
        if not state:
            raise SystemExit("Cannot resume: no saved gate state exists.")
        if state.get("status") == "completed":
            raise SystemExit("This gate is already completed; start a new gate with 'enter'.")
        state.update({"status": "in_progress", "resumed_at_utc": event["timestamp_utc"],
                      "resume_from": state.get("resume_from") or state.get("last_completed_step") or args.step,
                      "resume_details": args.details})
    with events_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=False) + "\n")
    state["updated_at_utc"] = event["timestamp_utc"]
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": state.get("status"), "resume_from": state.get("resume_from"),
                      "interruption": state.get("interruption"), "state_file": str(state_path),
                      "event_file": str(events_path)}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
