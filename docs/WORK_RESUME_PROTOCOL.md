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


## Latest durable checkpoint — 2026-10-19 (corrected after PR status recheck)

Checkpoint ID: `MOSHARROF-2026-10-19-CORRECTED-STATUS-03`. This is a documentation-only correction on branch `docs/refresh-durable-checkpoint-20261019`; it does not modify main/live.

- **PR #640:** merged as `7dc901b499716fd7a77114e4761f279f6288d854`. The previous checkpoint's statement that #640 was still open was stale and is superseded here.
- **PR #764:** now merged. The previous checkpoint's instruction to wait for #764's merge is obsolete. This merge does not, by itself, prove the next scheduled autonomous run completed useful work; inspect its actual run logs and look for either a real committed action or a clearly recorded safe no-op.
- **APK real-chat verification:** PR [#748](https://github.com/mosharrof0000-ux/Mosharrof/pull/748) remains open and unmerged. Its previously recorded emulator run [39197430377](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39197430377) was cancelled, not passed. Do not infer real chat success from APK build, static tests, or UI checks.
- **Current-main APK QA — EMULATOR PASS:** PR [#766](https://github.com/mosharrof0000-ux/Mosharrof/pull/766) at commit [`63d6206828c37aa8201ed565283770e555011559`](https://github.com/mosharrof0000-ux/Mosharrof/commit/63d6206828c37aa8201ed565283770e555011559) has a successful exact-head emulator run [#39272381571](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39272381571). Job `apk-webview-real-chat` passed, installed the matching APK, found the app WebView and visible composer, submitted one synthetic Bengali prompt, and recorded a 22-character non-mock response: `APK চ্যাট পরীক্ষা সফল।` Evidence artifact: [mosharrof-apk-webview-real-chat-39272381571](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39272381571/artifacts/12196241968); report recorded all four checks passed with no errors. Provider field was null, so the specific backend/provider identity is **not verified**. This is emulator-backed app-WebView evidence only, not a physical-phone test or a separate Live Pages test.
- **Physical Android phone:** NOT TESTED. Emulator evidence must not be described as physical-device verification.
- **Live Pages/provider:** do not claim live end-to-end chat is verified unless a direct, current test produces a real assistant reply and saves evidence.
- **Safe next actions:** (1) check PR #766's exact-head workflow run and diagnose any failure; (2) inspect PR #748's overlapping test/permission changes and decide whether to consolidate or close it only after reviewing dependencies; (3) verify the post-merge autonomous run after #764 and check its logs for actual work; (4) continue memory PR dependency and Android UI smoke triage from the latest evidence. Do not merge while required checks are red/pending, and do not claim background execution without a visible active/queued run.



## Night-duty status — 2026-10-19, 20:08 Asia/Dhaka

- PR #640 merged safely as `7dc901b499716fd7a77114e4761f279f6288d854`. It changed the six-hour worker to `cancel-in-progress: false`; all PR checks passed before merge.
- Main overnight cycle schedule is configured for UTC hours 14–23 and 00–02, equivalent to the intended Bangladesh 20:00–08:00 window. GitHub scheduled runs are best-effort, not a single guaranteed 12-hour process.
- The 20:00 scheduled event was not yet visible in the run list at the latest check (latest cycle before 20:00 was successful). The enabled `Mosharrof Backlog Recovery` automation at 20:00 Asia/Dhaka accepted an immediate run request; its completion is asynchronous and not yet confirmed.
- The post-merge six-hour run `39266014801` succeeded as a workflow but the log showed a safe pause because `AGENT_ACCESS_TOKEN` was empty. This was a real blocker, not a claim that all automation was working.
- PR #764 `fix(automation): keep six-hour agent running without dedicated token` was subsequently merged. Its implementation uses `MOSHARROF_RECOVERY_TOKEN || github.token`, scoped workflow write permissions, and bounded Gemini retries/fallback attempts isolated in `scripts/automation/gemini_provider.py`. The merge fixes the identified token fallback path, but the next scheduled/dispatch run still needs log-level verification for actual work or an explicit safe no-op.
- Do not treat a successful workflow conclusion alone as proof that backlog work was completed. Inspect its logs, outputs, and any resulting commit/PR; keep the APK/live real-chat acceptance criteria separate.
