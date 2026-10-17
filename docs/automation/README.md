# Automatic Work Engine Ledger

The automation-work-log branch is a dedicated operational ledger. It is intentionally separate from main and feature branches so automatic status recording never changes the active PR head or deploys the live site.

- latest-state.json: latest machine-readable state, including branch, commit SHA, workflow/run URL, checks, outcome, and next resume point.
- logs/YYYY-MM.md: readable start/finish history.
- events/YYYY-MM.jsonl: one JSON record per workflow event.

The engine records its own run plus completed GitHub Actions workflows. A green workflow is not automatically proof of a real physical-device test; inspect its artifacts and logs. The first run may create this branch.
