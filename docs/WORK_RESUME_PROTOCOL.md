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
- **PR #748 follow-up:** PR [#748](https://github.com/mosharrof0000-ux/Mosharrof/pull/748) remains open and unmerged. Its older emulator run [39197430377](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39197430377) was cancelled, not passed. On new head [`4bc96b6cdb451ba83d5f2f62e435fcbee46f45ac`](https://github.com/mosharrof0000-ux/Mosharrof/commit/4bc96b6cdb451ba83d5f2f62e435fcbee46f45ac), removed automatic grants for microphone, contacts, phone, and overlay permissions from the chat-only emulator test (least privilege). Its exact-head test result is not yet confirmed; do not infer success from other PR #766's separate emulator pass.
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


## Latest durable checkpoint — 2026-10-20 14:02 Asia/Dhaka

Checkpoint ID: `MOSHARROF-2026-10-20-CHAT-INTELLIGENCE-01`. This checkpoint supersedes the 2026-10-19 status for current work; it does not claim that stale runs are current evidence. Main/Live were not changed by this checkpoint.

### Priority A — resume protocol and backlog evidence

- **Task MOSHARROF-CHK-640 — PASS/CLOSED:** PR [#640](https://github.com/mosharrof0000-ux/Mosharrof/pull/640) is merged; merge commit `7dc901b499716fd7a77114e4761f279f6288d854`. Its former head branch `fix/resumable-task-progress-20261016` still points at `7b9a216bbf867e2e21c0e65f5da417e4c368ab0b`, but it is no longer the active PR branch. Do not reopen or update that merged PR.
- **Main snapshot:** `bbcebb2f80d7ab19bafc73f8132d28cdbcab8863` (commit message `Auto: guarded Mosharrof task (#787)`). Latest checkpoint text on main before this update was the 2026-10-19 night-duty section; no newer committed checkpoint was present.
- **Task CHAT-788 — PENDING review:** PR [#788](https://github.com/mosharrof0000-ux/Mosharrof/pull/788) is open/draft/mergeable, branch `feature/chat-intelligence-truthfulness-2026-10-20`, exact head `eaab3a4cd65d9757630302539e679de02b0c9080`. Changed paths: `core/reflective-chat-prompt.js`, new `core/reflective-intelligence-rules.js`, `tests/test_chat_intelligence_contract.py`, `tests/worker-loader.mjs`. Current-head tests [#39390011698](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011698), CI [#39390011653](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011653), ecosystem [#39390011683](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011683), verification gate [#39390011629](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011629), and candidate interaction QA [#39390011570](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011570) passed. Candidate Pages deploy job was skipped in [#39390011578](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011578); this is not a deployment or current Live verification.
- **CHAT-788 Android candidate QA — NOT TESTED/PENDING:** PR-head APK real-chat run [#39390011644](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011644) was cancelled. The separate main workflow-run [#39390196486](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390196486) concluded skipped, job `apk-webview-real-chat` skipped. Do not transfer older PR #785 evidence [#39377849198](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39377849198) to PR #788. Next action: inspect trigger/skip condition and run only the necessary current-head APK chat gate.
- **Live/PWA and Worker health — NOT TESTED for current main head:** current PR candidate interaction QA is not deployment proof; no direct fresh Worker `/health` response was collected in this run. Keep Live deployment blocked until approved current-head evidence is available.
- **Memory continuity — PARTIAL PASS:** PR #788 candidate browser-memory roundtrip [#39390011651](https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39390011651) passed; this is a browser smoke check, not proof of real-model quality or permanent memory.
- **Android physical device — NOT TESTED:** no physical handset acceptance evidence is available. Emulator evidence does not establish full device-control acceptance.
- **Open PR #739 — BLOCKED/duplicate-risk:** [#739](https://github.com/mosharrof0000-ux/Mosharrof/pull/739) remains draft and mergeability false; current-main APK QA was already merged via #766, so do not treat #739 as required duplicate QA without a concrete unique delta.
- **Prior failed exact-head tests:** earlier PR #788 push at SHA `30d541370b638e4d5f5d3779b0692dc742a12ca6` failed 3 runtime tests (chat provider failover, Cloudflare model rotation, image fallback). Current head's repository test run passed; keep the older failure as historical, not current-head status. Inspect if those tests regress again.

### Priority B — independent chat-intelligence evaluation lanes

The sprint plan and ten-lane scope are recorded in [issue #740 comment](https://github.com/mosharrof0000-ux/Mosharrof/issues/740#issuecomment-6286146072). PR #788's branch and overlapping prompt/contract files must remain untouched by parallel work. No claim that ten separate workers are active.

- **CI-EVAL-01 factuality/uncertainty + per-dimension report — PENDING:** create a separate branch/PR using new case/scorecard paths; mocked deterministic scorer only. Real model output benchmark remains NOT TESTED until authorized provider output is available.
- **CI-BN-02 Bengali clarity + multi-step completion — PENDING:** independent test file/branch; test requested language, ordered steps, constraints, and explicit partial completion.
- **CI-CTX-03 contradiction/correction + history — PENDING:** independent test file/branch; distinguish current user correction from stale memory and keep history as context rather than proof.
- **CI-MATH-04 arithmetic verification — PENDING:** deterministic arithmetic regression cases and explicit assumption/verification expectations.
- **CI-INJ-05 untrusted-source/prompt-injection — PENDING:** tests that retrieved/quoted content cannot override trusted instructions or authorize actions.
- **CI-MEM-06 memory boundaries — PENDING:** tests for relevant-only memory, current-request precedence, correction and avoid/forget honesty.
- **CI-PROV-07 provider failures — PENDING:** deterministic mocks for 429, 503, timeout, missing credentials and fallback ordering; no real secrets required.
- **CI-EVID-08 source/action-status honesty — PENDING:** tests that planned/queued/running actions are not reported as completed without postcondition evidence.
- **CI-REPORT-09 scorecard — PENDING:** separate dimension scores and sample-counts; no single aggregate pass can hide a failed dimension.
- **CI-REAL-10 real-model benchmark — NOT TESTED:** credentials/runtime availability not yet established for this run; do not invent output, score or provider identity.

### Next actions

1. Inspect and correct the current-head APK QA skip/cancellation condition for PR #788 without touching its active branch; preserve and poll any genuinely active job.
2. Implement one non-overlapping deterministic evaluation harness branch first, then separate small branches for Bengali/instruction/context/memory/injection/arithmetic and provider fallback tests.
3. Run focused pytest/Node checks on each candidate and record exact run links, artifacts and per-dimension results; real-model benchmark stays NOT TESTED unless actually run.
4. Update this checkpoint again only after new verified results, preserving this entry as the last durable state until a newer one is committed.
5. Never merge or deploy with red/pending required checks; do not claim live, real-model, or physical-device behavior from mocked tests.
