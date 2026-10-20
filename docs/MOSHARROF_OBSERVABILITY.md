# MOSHARROF observability and status protocol

## Purpose
Provide an evidence-backed, read-only snapshot for repository work so status answers can distinguish active, completed, failed, cancelled, skipped, and potentially stalled GitHub Actions jobs.

## Sources
- Open pull requests, branches, head SHAs, draft state, and PR links.
- The 30 most recent GitHub Actions runs, including status, conclusion, branch, SHA, timestamps, and run links.
- A run updated 45 minutes ago or earlier is flagged for inspection only; it is not automatically declared stopped.
- Snapshot JSON and Markdown are uploaded as a workflow artifact.

## How to run
Open the repository Actions tab, select **MOSHARROF Read-only Observability**, then **Run workflow**. After completion, open the run and download the `mosharrof-observability-<run-id>` artifact. The workflow also schedules an hourly read-only snapshot once this workflow exists on the default branch.

## Status rules
- **RUNNING**: GitHub reports a non-completed run.
- **CHECK STALE**: a non-completed run has not updated for at least 45 minutes; inspect job steps/logs before deciding it is stuck.
- **PASS**: completed with conclusion `success`.
- **FAIL**: completed with `failure`, `timed_out`, or `action_required`.
- **CANCELLED** and **SKIPPED** remain separate categories; never silently count them as passes.
- **NOT TESTED**: no direct evidence exists for the requested behavior.

## Explicit boundaries
This monitor is read-only. It never reruns jobs, merges PRs, writes to main, or deploys. It does not report ChatGPT internal task-automation execution, actual Pages/Worker runtime health, model-provider quality, or physical Android-device behavior. Those require their own source and direct verification. CI success does not establish that live chat or installed-APK real chat works.

## When asked for status
Refresh live GitHub evidence first; do not rely on this artifact if a newer state is available. Report each task with a direct link, status, last update, evidence, blocker, and next safe action. For real-chat verification, inspect the dedicated Android WebView Real Chat QA run and its uploaded evidence separately.
