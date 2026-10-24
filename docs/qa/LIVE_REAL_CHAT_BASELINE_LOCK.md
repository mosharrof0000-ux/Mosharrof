# Live Real-Chat QA Baseline — preserved 2026-10-24

## Lock decision
Preserve the existing Live real-chat QA implementation on this branch as a read-only comparison baseline. Do not change this branch to fix Android APK issues.

## Known verified source evidence
- QA workflow implementation commit: https://github.com/mosharrof0000-ux/Mosharrof/commit/a9250f1e6e852c0107f6a2c45b870641980c7b34
  - Adds the real live-chat round-trip probe to scheduled QA and after successful main Pages deployments.
- Related merged feature commit: https://github.com/mosharrof0000-ux/Mosharrof/commit/e1bd8cef5962731c7f280df4b284ee039a3b2fab
  - Commit message records candidate browser interaction, real-backend chat round-trip, CI, architecture, visual QA, verification gate, and APK build passing.
- Live site: https://mosharrof0000-ux.github.io/Mosharrof/

## Status boundaries
- **QA-CODE-PRESERVED**: the existing real-chat QA workflow code is preserved at this branch's starting commit.
- **LIVE-RUN-ARTIFACT-LINK-PENDING**: the exact successful live-only workflow run and its screenshot artifact have not yet been identified in the currently retrieved evidence. Do not substitute Android emulator artifacts for Live website screenshots.
- **ANDROID-APP-SEPARATE**: Android WebView/emulator/physical-device results are separate and must not overwrite this baseline.

## Change control
- Do not merge this baseline branch into main; it is a preservation reference.
- Future Android fixes must use a separate feature branch and PR.
- Any claim of a fully evidence-locked Live run must include the exact successful workflow run and screenshot artifact URLs.
- Do not claim physical-device acceptance without a real phone test and screenshot evidence.
