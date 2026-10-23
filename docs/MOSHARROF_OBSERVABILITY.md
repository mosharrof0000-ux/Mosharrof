# MOSHARROF Automation & Work Observability Engine

## Purpose
A read-only, evidence-backed monitor for repository work. It creates a JSON machine-readable report and a Markdown human-readable report, uploaded as a 30-day GitHub Actions artifact. It is designed to answer what is running, what passed, failed, was cancelled, was skipped, or looks stale.

## Run and schedule
- Workflow: **MOSHARROF Read-only Observability**.
- Manual run: repository Actions tab → workflow → Run workflow.
- Scheduled run: hourly at minute 17 (UTC), after this workflow is present on the default branch.
- Pull requests changing the monitor script/workflow run the monitor automatically.
- Artifact name: `mosharrof-observability-<run-id>`.
- First verified execution: https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39391962486

## Data collected
- All open PRs and open issues (paginated).
- Up to 100 most recent GitHub Actions runs with branch, SHA, event, timestamps, status, conclusion, and links.
- Job/step detail for active runs, recent failed runs, selected cancelled runs, and Android QA / monitor runs.
- Extracted root-cause signals from failed job logs (bounded lines, token-like values redacted), with direct links to full job logs.
- Explicit totals for active, potentially stale, failed, cancelled and skipped runs.
- Latest Android WebView Real Chat QA, latest monitor run, and latest main-branch push Pages workflow.
- Basic live Pages HTTP status and MOSHARROF AI brand-marker smoke check.

## Status interpretation
- **RUNNING / QUEUED / PENDING**: GitHub reports a non-completed run.
- **CHECK STALE**: no run update for at least 45 minutes; inspect job logs before concluding it is stuck.
- **PASS**: completed with conclusion `success`.
- **FAIL**: completed with `failure`, `timed_out`, `action_required`, or `startup_failure`.
- **CANCELLED** and **SKIPPED** are separate states, never counted as passes.
- **ATTENTION REQUIRED / UNKNOWN**: the source is unreachable or the check has no evidence.
- A Live HTTP/brand check is only a basic smoke test, not proof that chat, model providers, or Android behavior work.

## Safety
This monitor is read-only. It never retries jobs, cancels jobs, merges PRs, writes to main, or deploys. Stale age is a warning, not a diagnosis. It is safer to inspect job logs before retrying a failed/cancelled run. Do not merge a candidate with required checks pending or failing.

## Coverage boundaries
GitHub Actions can report GitHub workflow state; it cannot read the private execution state of ChatGPT's internal task automations. Those must be queried through the separate Automations connection. The report records this as a coverage gap rather than fabricating a state.
- Cloudflare Worker/provider runtime is not checked until a verified health endpoint is configured.
- Failed-job log signals are best-effort summaries; open the linked full logs for diagnosis if the excerpt is incomplete.
- A GitHub-hosted runner cannot observe the user's physical Android phone.
- Android real-chat proof requires the dedicated Android WebView Real Chat QA run and its evidence artifact.
- The Live Pages check is an HTTP/brand marker probe only.

## How to answer a status request
Refresh current GitHub evidence instead of relying only on an old artifact. Report status, direct link, last update, evidence, blocker, and next safe action for each relevant lane. Distinguish branch/PR checks from main-branch production deployment and from physical-device testing.
