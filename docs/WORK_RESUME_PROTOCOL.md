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


## Latest durable checkpoint — 2026-10-19 (Asia/Dhaka)

Checkpoint ID: `MOSHARROF-2026-10-19-01`. Main/Live was not modified or deployed during this inspection.

- **Android UI smoke — PENDING:** stacked PR [#745](https://github.com/mosharrof0000-ux/Mosharrof/pull/745), head `f68921d6d5ff5686ae5711ec32ed8c7bbaebf30b`. Previous run [39158140497](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39158140497) passed APK build/JVM tests but failed the emulator consent-dialog assertion. The follow-up replaces UiAutomator Bengali-text lookup with Activity/dialog hierarchy assertions. Latest exact-head run [39159456728](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39159456728) is pending; poll it and diagnose any failure. Parent PR [#731](https://github.com/mosharrof0000-ux/Mosharrof/pull/731) is still draft. Physical-device acceptance is NOT TESTED.
- **Installed APK real chat — NOT TESTED:** draft PR [#739](https://github.com/mosharrof0000-ux/Mosharrof/pull/739), head `b0c1bb0f5e0e7e44166188384f9946626fd7239d`. No matching workflow run appeared in the most recent 100 Actions runs; inspect its trigger and require exact-head evidence.
- **Live memory browser smoke — FAIL:** run [39157111517](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39157111517) timed out after 45 seconds waiting for a POST response ending in `/chat`. Existing isolated branch `fix/memory-browser-smoke-routing-20261019`, commit `3d3cb280041c4a24b595993543669bde34504b3`, blocks service workers in the Playwright context; general and memory/timeline tests passed in [39157713553](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39157713553), but the candidate browser smoke is not yet verified green.
- **Memory PR cluster — BLOCKED:** [#671](https://github.com/mosharrof0000-ux/Mosharrof/pull/671) has a stale-base test failure where `timeline` is not exported by the engine API plus provider-failover test failures. [#674](https://github.com/mosharrof0000-ux/Mosharrof/pull/674) has a size-gate failure (test file grew 3640B → 4532B) and provider-failover failures on its stale merge base. PRs #675/#676 overlap memory runtime asset work; consolidate/rebase before promotion.
- **Android dependency cluster — BLOCKED/PENDING:** [#648](https://github.com/mosharrof0000-ux/Mosharrof/pull/648), [#723](https://github.com/mosharrof0000-ux/Mosharrof/pull/723), [#731](https://github.com/mosharrof0000-ux/Mosharrof/pull/731), and stacked #745 are not a finished, physically accepted Android assistant. #723 currently reports mergeability false.
- **Snapshot:** 50 open PRs (not 50 distinct unfinished tasks). Latest observed successful Pages deployment run [39157007873](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39157007873) used commit `bd5484d302a4ab243e419e9b59d67e62c7b6304e`; this does not prove real chat/memory success. Direct Live-site browsing was unavailable through the current browser tool, so preserve the Actions smoke failure as the evidence.
- **Next order:** poll exact-head Android CI; run the candidate memory browser smoke with service workers blocked; consolidate/rebase the memory PR cluster; verify PR #739's APK chat workflow; re-check Live/Worker health after any approved promotion. Never merge while checks are red/pending and never claim physical-device or real Live chat success without direct evidence.


## Latest durable checkpoint — 2026-10-19 (rechecked)

Checkpoint ID: `MOSHARROF-2026-10-19-MULTI-ENGINE-RECHECK-02`. Recorded on the existing isolated checkpoint branch for PR #640; main was not modified by this checkpoint write.

- **Automation run requested:** the enabled `Mosharrof Backlog Continuation` automation accepted an immediate run request. This confirms the request was queued, not that its work or notification completed. Existing daily schedule remains unchanged.
- **Current main baseline:** `9176828df5e2190ea6e123db1e4459c22ec329df`.
- **Parallel automation / CI evidence:** `MOSHARROF Parallel Engine Builder` [run 39260923775](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39260923775) passed; [Automatic Work Engine run 39261161540](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39261161540), [Full-System Interaction QA 39261134358](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39261134358), [Personal Memory Browser Smoke 39261134322](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39261134322), [Mosharrof CI 39260907941](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39260907941), [Pages deploy/health workflow 39260907927](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39260907927), and [Android APK build 39260907864](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39260907864) are successful. These are CI/workflow results; they do not prove physical-device behavior or a successful real chat response.
- **Installed APK real-chat QA — FAIL/PENDING RETRY:** open PR [#748](https://github.com/mosharrof0000-ux/Mosharrof/pull/748), head `9d69dd88c2a2bf097fc2bc219e5fa6a4e2e4d2c5`, is mergeable but not merged. Its earlier QA run [39197430377](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39197430377) is **cancelled**, not passed; the job/artifact query returned no jobs/artifacts. Do not merge PR #748 until a fresh exact-head emulator run proves a non-mock backend response. Physical-phone test remains NOT TESTED.
- **Checkpoint PR:** [#640](https://github.com/mosharrof0000-ux/Mosharrof/pull/640) remains open and mergeable at its known head `2ad5edd393d04e62122c1a4122d955d3cfed19c6`; the checkpoint document exists on its branch even though it was not found on default branch. This update stays on that branch and must still pass review/checks before merge.
- **Next actions:** (1) inspect why the APK real-chat QA run was cancelled and get a fresh run for PR #748's current head without duplicating healthy jobs; (2) poll and repair the older Android UI smoke, memory browser smoke, and memory PR dependency cluster listed above; (3) maintain one durable checkpoint after each meaningful repair; (4) only promote after all required checks are green. Do not treat a queued automation request as completed work or claim continuous background execution without fresh run evidence.


## Night-duty status — 2026-10-19, 20:08 Asia/Dhaka

- PR #640 merged safely as `7dc901b499716fd7a77114e4761f279f6288d854`. It changed the six-hour worker to `cancel-in-progress: false`; all PR checks passed before merge.
- Main overnight cycle schedule is configured for UTC hours 14–23 and 00–02, equivalent to the intended Bangladesh 20:00–08:00 window. GitHub scheduled runs are best-effort, not a single guaranteed 12-hour process.
- The 20:00 scheduled event was not yet visible in the run list at the latest check (latest cycle before 20:00 was successful). The enabled `Mosharrof Backlog Recovery` automation at 20:00 Asia/Dhaka accepted an immediate run request; its completion is asynchronous and not yet confirmed.
- The post-merge six-hour run `39266014801` succeeded as a workflow but the log showed a safe pause because `AGENT_ACCESS_TOKEN` was empty. This was a real blocker, not a claim that all automation was working.
- PR #764 `fix(automation): keep six-hour agent running without dedicated token` addresses that blocker by using `MOSHARROF_RECOVERY_TOKEN || github.token`, granting scoped workflow write permissions, and testing the fallback. Its first feature-branch execution reached Gemini but failed with HTTP 503. The PR now also adds bounded retries and fallback model attempts in `scripts/autonomous_agent.py`. Current head: `e7cd05bdadc0198d0b74b7f1b808eb47ff5a3c1b`; tests/checks still running at checkpoint time.
- Do not merge PR #764 until all required checks are green. Recheck the exact head, run logs, APK build and Live deploy checks. Then verify the next scheduled overnight run and inspect its logs for a real agent action or an explicit safe no-op; do not count a successful safe-pause step as autonomous work completed.
