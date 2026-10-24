# Android Control: Task Report and Green-Lock Ledger

## Purpose
Track install/uninstall and device-control work as small, independently verifiable units. This ledger is not evidence that a feature passed; every status must point to an exact commit and test result.

## Status vocabulary
- **GREEN-LOCKED**: exact commit passed all required automated tests and the reviewed behavior is stable. Lock means freeze that commit/scope; changes require a new branch/PR and re-verification.
- **CI-GREEN / DEVICE-PENDING**: automated build/tests pass, but no physical-device acceptance evidence exists.
- **IN-PROGRESS**: implementation or tests are incomplete.
- **BLOCKED**: requires unavailable pairing, permissions, credentials, or device access.
- **FAILED**: a reproducible assertion or runtime failure has been observed.
- **UNKNOWN**: dispatch occurred but no trustworthy terminal result was observed.

## Current baseline assessment
- The existing Android agent and typed local command gate are present on the PR #723 feature branch.
- PR #723 is open and draft; it is not merged and is not mergeable at the time of this assessment.
- The web-to-app deep-link handoff is one-way. Authenticated remote pairing and reliable correlated task-result callbacks are not complete.
- Install/uninstall must use Android-owned installer/uninstaller UI and retain OS confirmation.
- Emulator/CI evidence must never be reported as physical-device evidence.
- Do not mark the whole Android control engine GREEN-LOCKED until the exact head has green build, unit and emulator checks, security tests, and physical-device acceptance.

## Small-module implementation order
1. `pairing/`: explicit device pairing, expiry, revoke and authenticated transport. Never log pairing secrets.
2. `protocol/`: bounded request envelope with request ID, allowlisted action, expiry and replay protection.
3. `execution/`: route install/uninstall to Android's package installer/uninstaller; keep OS confirmation.
4. `results/`: correlated terminal states: SUCCESS, FAILED, CANCELLED, UNKNOWN, with redacted evidence.
5. `reporting/`: append-only task report with timestamps, app/package identity, authorization outcome, result verification and evidence references.
6. `tests/`: unit, replay/expiry/authorization tests, emulator instrumentation and device acceptance checks.

Avoid a large rewrite or duplicate controller. Reuse existing Android agent and command gate where compatible.

## Required per-task report fields
- task_id and request_id
- requested_action and normalized_action
- target_package and displayed_app_label, when available
- device/app build identity and test environment (CI, emulator, physical device)
- authorization/consent state; never store secrets or sensitive screen contents
- started_at, finished_at, elapsed_ms
- terminal_status: SUCCESS, FAILED, CANCELLED, UNKNOWN
- verification_method and postcondition result
- failure_category, bounded diagnostic, retry_count
- evidence links and exact commit SHA
- lock_status and reviewer decision

## Install acceptance
- Validate package identifier and APK provenance/source before handing off.
- Show the target app, requested source and expected consequence to the device owner.
- Open Android's installer flow; never claim installation merely because the installer opened.
- After the OS flow returns, verify package presence/version using permitted Android APIs.
- If the user cancels, report CANCELLED. If the outcome cannot be verified, report UNKNOWN, not SUCCESS.
- Never auto-retry a non-idempotent action when its previous outcome is UNKNOWN.

## Uninstall acceptance
- Resolve and display the exact target app/package before proceeding.
- Require explicit confirmation and invoke Android's system uninstall UI.
- Verify package absence after the system flow returns.
- Preserve user data by default; do not imply that uninstall always removes all external data.
- If cancelled or unverified, report CANCELLED or UNKNOWN rather than success.

## Green-lock policy
1. Record exact head SHA and links to successful build, unit tests and emulator tests.
2. Keep physical-device acceptance separately marked until evidence is genuinely captured on a real phone.
3. Once green, freeze the tested scope/commit in this ledger; do not modify it in place.
4. Any later change gets a new branch/PR and repeats the relevant tests.
5. Do not merge to main or deploy Live while required checks are red, missing or inconclusive.

## Current lock decision
**CI-GREEN / DEVICE-PENDING is the strongest status permitted by prior CI evidence.** The current remote pairing/result bridge is still IN-PROGRESS. No physical-device install/uninstall acceptance is claimed by this file.
