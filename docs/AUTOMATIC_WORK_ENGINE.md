# MOSHARROF Automatic Work Engine

## Purpose

Automatically record the work lifecycle so progress survives a ChatGPT page/session change:

1. **Before work:** record the triggering event, repository, branch, commit SHA, what was checked, planned checks, and run URL.
2. **During/after work:** run the engine contract tests and record success/failure/cancellation plus the next resume point.
3. **Persist:** write a readable monthly log and machine-readable event records to the dedicated `automation-work-log` branch, not to `main` or the active feature branch.
4. **Resume:** read `docs/automation/latest-state.json` on the log branch first, then the monthly log and linked Actions run. Continue from the first pending or failed item; do not repeat completed work without reason.

## Implementation

- Workflow: `.github/workflows/automatic-work-engine.yml`
- Recorder: `scripts/automation/work_engine.py`
- Contract tests: `tests/test_work_engine.py`
- Automatic triggers: branch pushes, manual dispatch, pull-request validation, and completed GitHub Actions workflows.
- The workflow records the source workflow's result on `workflow_run` events and stores its own run artifact.
- The log branch is deliberately separate so status recording cannot move the active PR head or trigger a live deployment.

## Ledger files on the automation-work-log branch

- `docs/automation/latest-state.json` — most recent state, source SHA, run URL, checked items, outcome, and next resume point.
- `docs/automation/logs/YYYY-MM.md` — human-readable start/finish history.
- `docs/automation/events/YYYY-MM.jsonl` — machine-readable records, one JSON object per event.
- Actions artifact `MOSHARROF-Work-Engine-<run id>` — copy of the current event record and latest state.

## Operating rules

- A run starts as `in_progress`; it is not called successful until the finish record says so.
- Failed checks must be investigated using the linked job logs; fixes belong on a safe feature branch.
- No automatic merge or production deployment is performed by this work engine.
- A green browser/emulator workflow does not prove control of the user's physical phone.
- Real-device Accessibility, overlay, call, contacts, file, or other sensitive capabilities must use owner-authorized Android permission flows.
- This is an automatic status recorder and workflow orchestrator foundation, not yet a self-modifying unrestricted AI developer. Future task planning, code changes, repairs, and promotion need separate bounded workers and verified acceptance gates.
- The engine's `workflow_run` trigger begins recording other workflows only after this workflow is available on the repository's default branch. Until then, push/manual runs can be validated on the feature branch.

## Resume instructions

1. Open the repository's `automation-work-log` branch.
2. Read `docs/automation/latest-state.json` and the current month under `docs/automation/logs/`.
3. Open the linked Actions run and inspect artifacts if any result is pending/failed.
4. Resume from the recorded `next_step`, preserving the recorded branch and SHA.
5. After a milestone, update the project checkpoint as well; this ledger is the automatic event log, not a replacement for feature-specific acceptance documentation.
