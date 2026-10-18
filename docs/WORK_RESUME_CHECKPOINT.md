# MOSHARROF Work Resume Checkpoint

Last updated: 2026-10-18 18:47 UTC (2026-10-19 00:47 Bangladesh time)

Purpose: resume from verified current evidence after a ChatGPT page/session change. Recheck exact SHAs and run states before acting. Preserve `main` and Live Pages; promote only through a clean PR with green required checks.

## Current repository and deployment

- Repository: https://github.com/mosharrof0000-ux/Mosharrof
- Live Pages: https://mosharrof0000-ux.github.io/Mosharrof/
- Main commit at checkpoint: `e7e47ed6fc1357f60b10f240bb3b8072735b335a`
- Latest Pages deployment for this commit: QUEUED at checkpoint — https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39155582626. Do not claim the e7e47 deployment is live until this run succeeds.
- Main CI at e7e47: SUCCESS — https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39155582834

## Completed and verified

1. **Full-app interaction QA merged** — PR #727: https://github.com/mosharrof0000-ux/Mosharrof/pull/727
   - Mobile browser/PWA UI inspection, drawer/composer interactions, screenshots and JSON evidence.
   - Superseded PR #692 was closed: https://github.com/mosharrof0000-ux/Mosharrof/pull/692
2. **Hourly overnight backlog cycle is on main** — PR #728 added the scheduler; PR #734 changed it to hourly and merged.
   - Current cron in `.github/workflows/autonomous-cycle.yml`: `0 0-2,14-23 * * *` UTC, covering 20:00–08:00 Bangladesh time hourly.
   - Each pass is bounded (25-minute job timeout), collects open PRs/issues and recent workflow runs, prioritizes existing work, and writes a reviewable patch only after its own checks pass. This is repeated hourly work, not one uninterrupted 12-hour process.
3. **Resumable/reviewable automation merged** — PR #732: https://github.com/mosharrof0000-ux/Mosharrof/pull/732
   - Adds resilient backlog collection/task construction and opens a PR for verified autonomous patches.
4. **Autonomous PR checks token fix merged** — PR #736: https://github.com/mosharrof0000-ux/Mosharrof/pull/736
   - The nightly cycle prefers `MOSHARROF_RECOVERY_TOKEN` and falls back to `github.token`, so normal PR workflows can run when the recovery token is available. It does not auto-merge its own patch.
5. **Real live-chat round-trip is proven on two deployed commits**
   - Run #39153647185 SUCCESS on commit a9250: https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39153647185
   - Run #39154827007 SUCCESS after the hourly-schedule deployment on commit e2f66: https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39154827007
   - The real-chat step sent a Bengali test prompt to the deployed site, received a non-empty assistant reply, and passed its response assertions. The report did not expose a provider name; do not infer which provider answered.
6. **Live PWA UI and browser memory checks**
   - UI report #39152903268: 50/50 interaction checks passed; the chat round-trip in that report was mocked, not real-provider evidence: https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39152903268
   - Browser memory round-trip passed: https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39152903286
7. **ChatGPT night-duty automation**
   - `Mosharrof Backlog Recovery` is enabled with an evening target in `Asia/Dhaka`; an immediate run was requested asynchronously. This is not proof that a run completed and does not replace the GitHub hourly schedule.

## Android native assistant: current blocker and recovery

- **Clean foundation PR #731**: https://github.com/mosharrof0000-ux/Mosharrof/pull/731
  - Branch: `feat/android-agent-foundation-clean-2026-10-18`
  - Current head at checkpoint: `5383e9add40339688ab5a559cd753d9687d2e075`
  - Draft; last metadata reported mergeable=true. Recheck mergeability and base SHA before promotion because main has advanced.
  - Latest Android Agent CI run #39155469831 is IN PROGRESS: https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39155469831. Setup/checkout/JDK/Gradle succeeded; debug APK build is in progress, unit and emulator tests have not yet run in this attempt.
  - The workflow now bounds preflight ADB commands, test-APK build, APK installs and instrumentation to avoid indefinite hangs.
- **Old foundation PR #648**: https://github.com/mosharrof0000-ux/Mosharrof/pull/648
  - Old head `fce9e2afa96e5e02b9991c5a88ea018ab3c77b6f`; based on stale main.
  - Android Agent CI #39152902212 failed on the old emulator/UTP path. Do not merge it. Keep it open until PR #731 passes and is merged, then close it as superseded.
- **Old assistant PR #723**: https://github.com/mosharrof0000-ux/Mosharrof/pull/723
  - Current head `36fd11cf8b814cbb0b3977f73dc82f629c7105a7`; draft and based on stale foundation branch `68d6d6bbf75cc4530cfbd843ad5e66265372762c`.
  - A prior direct-ADB emulator run #39153496720 succeeded with `OK (2 tests)`: https://github.com/mosharrof0000-ux/Mosharrof/actions/runs/39153496720
  - That successful run was on the earlier head before the latest timeout guards. The current head still needs a fresh check and is not mergeable as the canonical assistant PR.
- **Root cause learned**: old instrumentation runs showed an unresponsive emulator/UTP installer reporting API level 1 despite APK compilation and JVM unit tests passing. Direct ADB installation plus `am instrument` passed on the earlier assistant branch; the clean foundation branch adds bounded ADB preflight/install/test commands. Do not call physical-device acceptance proven.
- **Separate APK chat gap**: the main `Build MOSHARROF Android APK` workflow currently builds and contract-checks the APK but does not yet run a real chat round-trip inside the installed APK/WebView. Live PWA chat success is not Android APK chat proof.

## Exact next actions

1. Recheck Android Agent CI #39155469831 until terminal. If it fails, inspect logs/artifacts and fix the exact root cause on PR #731; do not merge while pending/red.
2. Once PR #731's exact-head checks are green and mergeability is clean, mark ready and merge it; then close PR #648 as superseded.
3. Create a clean assistant PR from PR #723's incremental diff on current main. Preserve current main's newer `core/composer-enhancements.js`; manually combine the stronger permission-disclosure assertions with the assistant UI smoke test rather than blindly copying a conflicting stale test file.
4. Add a separate emulator-backed test of the actual generated MOSHARROF APK/WebView chat, using the built APK artifact and a real backend round-trip. Run it after a successful main APK build and nightly; inspect the report and fix CORS/backend issues if found.
5. Keep the hourly overnight cycle and PR publisher checks green. Re-enumerate open PRs/issues from the live API; do not rely on old backlog counts.

## Safety and evidence rules

- No direct edits to main; use isolated branches and PRs.
- Never merge/deploy with pending/red required checks, unresolved conflicts, or dirty merge state.
- Mocked browser chat, real web chat, native Android instrumentation, APK/WebView chat, and physical-phone tests are separate evidence categories.
- Never claim real-provider chat passed unless the real-chat step ran and its response assertion passed.
- Never claim physical-phone acceptance unless an authorized physical device was actually connected and tested.
- The user may continue planning and working during night duty; the worker must not lock the project or override newer user priorities.
