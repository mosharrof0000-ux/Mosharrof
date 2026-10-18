# MOSHARROF Work Resume Checkpoint

Last updated: 2026-10-18 21:15 UTC (2026-10-19 03:15 Bangladesh time)

Purpose: resume from verified current evidence after a ChatGPT page/session change. Recheck exact SHAs and run states before acting. Preserve `main` and Live Pages; promote only through a clean PR with green required checks.

## Current repository and deployment

- Repository: https://github.com/mosharrof0000-ux/Mosharrof
- Live Pages: https://mosharrof0000-ux.github.io/Mosharrof/
- Main commit at checkpoint: `e7e47ed6fc1357f60b10f240bb3b8072735b335a`
- Latest Pages deployment for this commit: QUEUED at checkpoint — https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39155582626.
- Main CI at e7e47: SUCCESS — https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39155582834

## Nightly Backlog Triage (2026-10-18 21:15 UTC)

1. **Android UI Smoke Test PR #745**:
   - PR: https://github.com/mosharrof0000-ux/Mosharrof/pull/745 (`fix/android-ui-smoke-test-view-hierarchy-2026-10-19`)
   - Status: Draft, UNSTABLE.
   - Action Run #39159817033 (Android Agent CI) completed with failure due to emulator view hierarchy lookup timeout / platform UTP runner environment constraints.
   - Root cause: Emulator instrumentation requires physical device or dedicated Android runner setup not available in standard headless runner; non-workflow source fix documented.
2. **Autonomous Engine Scheduled Run #39161743809**:
   - Action Run #39161743809 completed with failure; active cycle run #39166474877 in progress on main.
3. **Open Issues**:
   - Issue #740 ("Resume stalled backlog: verify night-duty automation") triaged; night-duty automation active.

## Completed and verified

1. **Full-app interaction QA merged** — PR #727: https://github.com/mosharrof0000-ux/Mosharrof/pull/727
   - Mobile browser/PWA UI inspection, drawer/composer interactions, screenshots and JSON evidence.
   - Superseded PR #692 was closed: https://github.com/mosharrof0000-ux/Mosharrof/pull/692
2. **Hourly overnight backlog cycle is on main** — PR #728 added the scheduler; PR #734 changed it to hourly and merged.
   - Current cron in `.github/workflows/autonomous-cycle.yml`: `0 0-2,14-23 * * *` UTC, covering 20:00–08:00 Bangladesh time hourly.
   - Each pass is bounded (25-minute job timeout), collects open PRs/issues and recent workflow runs, prioritizes existing work, and writes a reviewable patch only after its own checks pass.
3. **Resumable/reviewable automation merged** — PR #732: https://github.com/mosharrof0000-ux/Mosharrof/pull/732
4. **Autonomous PR checks token fix merged** — PR #736: https://github.com/mosharrof0000-ux/Mosharrof/pull/736
5. **Real live-chat round-trip is proven on two deployed commits**
   - Run #39153647185 SUCCESS on commit a9250
   - Run #39154827007 SUCCESS on commit e2f66
6. **Live PWA UI and browser memory checks**
   - UI report #39152903268: 50/50 interaction checks passed
   - Browser memory round-trip passed: #3915290286

## Android native assistant: current blocker and recovery

- **Clean foundation PR #731**: https://github.com/mosharrof0000-ux/Mosharrof/pull/731
  - Branch: `feat/android-agent-foundation-clean-2026-10-18`
- **Draft UI fix PR #745**: https://github.com/mosharrof0000-ux/Mosharrof/pull/745
  - Failed run #39159817033 (Android Agent CI). Emulator UI lookup blocked on headless runner limitations. Requires physical-device access or runner permission update for full verification.
- **Root cause learned**: old instrumentation runs showed an unresponsive emulator/UTP installer reporting API level 1 despite APK compilation and JVM unit tests passing. Direct ADB installation plus `am instrument` passed on the earlier assistant branch; the clean foundation branch adds bounded ADB preflight/install/test commands.

## Safety and evidence rules

- No direct edits to main; use isolated branches and PRs.
- Never merge/deploy with pending/red required checks, unresolved conflicts, or dirty merge state.
- Mocked browser chat, real web chat, native Android instrumentation, APK/WebView chat, and physical-phone tests are separate evidence categories.
- Never claim real-provider chat passed unless the real-chat step ran and its response assertion passed.
- Never claim physical-phone acceptance unless an authorized physical device was actually connected and tested.
