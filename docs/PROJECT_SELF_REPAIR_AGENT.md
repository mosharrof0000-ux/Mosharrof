# MOSHARROF AI — Project Awareness and Safe Self-Repair

## Current implementation status (2026-10-16)

**Implemented: P1 read-only project inventory foundation.**
- `scripts/mosharrof_project_inventory.py` reads repository metadata, the default-branch commit, open pull requests, and recent Actions runs through read-only GitHub API requests.
- Optional health checks accept HTTPS URLs only and issue a GET request.
- Output records UTC generation time, exact observed SHA, source availability, warnings, and explicit safety flags showing that no write, deployment, or promotion occurred.
- `.github/workflows/project-inventory.yml` provides a manual-only workflow_dispatch entry point with read-only repository permissions, a short timeout, a run summary, and a 14-day JSON artifact.
- `tests/test_project_inventory.py` covers report contents, unavailable sources, malformed repository names, metadata failure, and HTTPS-only health checks.

This is a read-only inventory, **not an autonomous repair agent**. It does not edit code, open PRs, merge, deploy, or run continuously. It runs only when manually dispatched from the Actions tab. A successful code/test build does not count as an inventory report; the workflow must be run and its artifact inspected.

Status: foundation specification; implementation is phased. This document does not claim that autonomous repair is already running.

## Goal

MOSHARROF should know the verified state of its own project and the user's approved goals, distinguish facts from assumptions, detect failures, propose bounded repairs, test changes, and report evidence. It must not silently mutate production or claim a repair succeeded without verification.

## Source-of-truth order

1. Live repository metadata and current default-branch commit from GitHub.
2. Current open PRs, their base/head SHAs, review state, and check results.
3. Latest workflow runs and their actual conclusions/log evidence.
4. Deployment health checks and version/build identifiers.
5. A dated project ledger containing verified milestones, user decisions, known regressions, blockers, and next steps.
6. User-approved profile/preferences and relevant prior conversation excerpts.

If sources disagree, show the conflict and prefer newer verified evidence for technical state. Never treat a remembered SHA or old chat message as the current state without checking it.

## Required project-state snapshot

Every diagnosis should record:
- timestamp (UTC), repository, default branch and observed commit SHA;
- open PRs, base/head branches and SHAs, draft/review/merge status;
- required checks and each check's conclusion;
- latest deployment/version and health-check result, when available;
- known issue, reproduction, expected behavior, actual behavior;
- confidence and source URL for every finding;
- proposed next action, approval requirement, and rollback reference.

Never put API keys, access tokens, private user data, or raw secrets into the snapshot or logs.

## Safe repair loop

1. **Observe:** read-only inventory first. Do not change files, settings, secrets, deployments, or devices.
2. **Reproduce:** identify a concrete failing test, workflow, health check, or user-provided reproduction.
3. **Diagnose:** separate verified facts from hypotheses; state what evidence would disprove each hypothesis.
4. **Plan:** produce a minimal patch plan, risk level, affected files, tests, rollback path, and whether user approval is needed.
5. **Authorize:** request explicit user approval before creating or applying a repair that changes project code, permissions, settings, data, or production behavior. Read-only diagnostics may run automatically only within granted access.
6. **Isolate:** create a new feature/repair branch from a verified base SHA. Never patch the live/default branch directly.
7. **Patch:** limit the diff to the approved scope; do not modify secrets or widen permissions as a workaround.
8. **Verify:** run focused regression tests, the repository's full required CI, security checks, and relevant build/health checks. A skipped, missing, stale, or inconclusive check is not a pass.
9. **Review:** open a draft PR with evidence, risks, and rollback instructions. Do not self-approve or merge merely because tests pass.
10. **Promote:** require the repository's existing protection/review policy and explicit user approval before merge/deploy. No direct production deployment from a draft branch.
11. **Post-check:** verify the deployed version and a real health check; compare with expected behavior.
12. **Record:** append what was changed, exact commit/PR/run URLs, test results, approval, rollback instructions, and next step. If verification fails, report failure and stop promotion.

## Autonomy levels

- **Level 0 — Observe:** read project state and explain it.
- **Level 1 — Diagnose:** inspect logs/tests and propose a repair.
- **Level 2 — Prepare:** create an isolated branch and draft patch only after explicit approval.
- **Level 3 — Verify:** run approved checks and assemble evidence.
- **Level 4 — Promote:** merge/deploy only with explicit approval and required review/checks.
- **Level 5 — Recover:** execute a pre-approved rollback procedure only when the exact target, scope, and authorization are documented; verify recovery afterward.

Default is Level 0/1. Approval does not carry over to a different repair, broader scope, destructive action, or production deployment.

## Failure and rollback rules

- Stop if the base SHA changes unexpectedly, branch ancestry is unclear, required checks are missing, permissions are broader than approved, secrets might be exposed, or the patch exceeds its approved scope.
- Never delete user data or secrets as a diagnostic shortcut.
- Keep the last known-good deployment/commit and a documented recovery command/link where repository policy permits.
- A green unit test is not proof that the live service is healthy.
- If rollback cannot be safely automated, provide the exact verified manual recovery steps rather than improvising.

## Personal project memory

Keep separate records for:
- user-stated goals/preferences;
- technical facts proven by repository/workflow/deployment evidence;
- hypotheses awaiting confirmation;
- decisions and approvals;
- completed work and its evidence;
- open blockers and next steps.

Each record needs a timestamp, source, status (current/superseded/unverified), and correction/deletion path. When a new request conflicts with an old preference, ask if the conflict affects a consequential action. Do not infer personal facts from code or analytics.

## Implementation phases

- **P1 — Read-only project inventory:** obtain repo/default branch, latest commit, open PRs, and check status; render a dated status report.
- **P2 — Failure triage:** correlate failing workflow jobs, tests, PR diff, and issue reports; propose a minimal fix with evidence.
- **P3 — Repair sandbox:** approval-gated branch creation, patching, regression tests, and draft PR creation.
- **P4 — Post-merge/deploy verification:** health check, build/version comparison, rollback recommendation, and completion report.
- **P5 — Persistent project ledger:** save verified state and decisions across chats with source links and stale-state detection.
- **P6 — Controlled improvement:** analyze feedback and recurring failures, add regression tests, and propose improvements; model-weight training is outside MOSHARROF's control.

## Acceptance criteria

- The status report identifies the exact observed SHA and timestamp.
- Every claim of success has a check/run/health-check reference.
- An unverified or unavailable state is clearly labeled.
- The system can explain what is broken, why it believes so, and which evidence supports it.
- No code change, merge, deployment, device action, or destructive recovery happens without the appropriate explicit approval.
- A failed or uncertain verification blocks promotion and produces an honest report.
