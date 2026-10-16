# Work resume and progress protocol

## Purpose

This protocol protects work from mobile-app crashes, chat navigation, network interruptions, and duplicate requests. A disconnected phone does not by itself stop a GitHub Actions run; the authoritative execution status is the GitHub Actions run, not the phone UI.

## Commands available on a GitHub issue

Add a comment to a regular GitHub issue (not a pull request):

- `/mosharrof status` — checks recent autonomous workflow runs and replies with actual status, current step where available, and the run link.
- `/mosharrof resume` — if a relevant run is already queued/running, leaves it alone and reports it; otherwise dispatches a new guarded task that first inspects recent runs, open PRs, branches, commits and evidence before continuing from the latest durable checkpoint.

The workflow command is available at `.github/workflows/work-resume-command.yml`. It does not expose secret values. It reports that a resume request was dispatched only after GitHub accepts the dispatch API call. If the autonomous pipeline credentials are absent, the pipeline should safely pause and report that prerequisite.

## Required behavior

1. **Do not cancel active work for a new request.** All workflows sharing the `mosharrof-autonomous` concurrency group must set `cancel-in-progress: false`. A new run queues rather than cancelling the active run.
2. **Check before repeating.** Before implementing or testing a request again, inspect the latest relevant pull request, branch, commit, and workflow run. Reuse the existing branch and successful evidence where valid.
3. **Resume from the last durable checkpoint.** Continue from the last committed change or completed workflow stage; rerun only the failed or invalidated stage. Do not claim to resume a process that GitHub has marked cancelled or that has no persisted checkpoint.
4. **Report status using evidence.** Use only these labels:
   - `RUNNING`: the current GitHub Actions run is actually in progress.
   - `QUEUED`: GitHub has accepted the run but it has not started.
   - `PAUSED/BLOCKED`: execution cannot continue due to a missing secret, permission, approval, quota, or failed prerequisite.
   - `FAILED`: the run ended with failure; include the failed stage and next action.
   - `SUCCESS`: the run completed successfully; this does not by itself prove physical-device or live-provider behavior.
   - `NOT RUNNING`: no relevant active/queued run exists.
5. **Long-running tasks need checkpoints.** Before stopping work, record task objective, current branch/PR, last verified stage and evidence link, unresolved issue, and the exact next action. Never overwrite a newer checkpoint with an older run.
6. **Keep main safe.** Work in a branch, test, open a PR, wait for required checks, and verify deployment after merge. Do not reset or force-push main to resume a task.
7. **Timeout is not permission to cancel the task.** If a run reaches its timeout, preserve its logs/artifacts, mark the task blocked at the failed stage, and continue from the last durable checkpoint in a new run.

## User commands in ChatGPT

When the user says **“কাজ কোথায় থেমেছে কাজ আরম্ভ করো”**:
- inspect the latest task checkpoint, open PRs, branch, and associated workflow runs;
- identify the last successful stage and the next incomplete stage;
- continue from there, not from the beginning;
- report the exact checkpoint and evidence.

When the user asks **“কাজ চলতেছে কিনা”**:
- query GitHub Actions for the current relevant run and report the actual state;
- include the workflow/run link and current or last completed stage;
- never say a task is running based only on a previous intention or an open PR.

## Current implementation boundary

The concurrency safety fix prevents newer autonomous runs from cancelling an active run in the two workflows listed below. The issue-comment command checks actual GitHub Actions state and avoids launching duplicate work when a relevant run is active. A resume request asks the agent to inspect existing PRs/branches/evidence before continuing. It does not revive a cancelled process at an arbitrary instruction: a new run can only continue from state that was durably committed or saved as an artifact. Real-device acceptance tests still require the device to be available.
