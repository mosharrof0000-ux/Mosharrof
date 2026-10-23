# Parallel Root-Cause Automation: Permissions and Safety Contract

## Goal

Resolve one failed acceptance goal faster by investigating distinct plausible causes concurrently. Parallelism is for alternative solutions to the same goal, never unrelated tasks.

## Operating state machine

1. **Capture** — save triggering run URL/ID, failed source SHA, full logs, artifacts, environment, and exact acceptance command before edits.
2. **Hypothesize** — derive a ranked list from evidence. Default to six lanes; allow up to ten only when there are that many distinct, testable hypotheses. Do not pad the list.
3. **Isolate** — each remediation lane must have its own branch/worktree, checkout SHA, scratch state, log, and artifact namespace. Shared physical devices, databases, deployments, and rate-limited APIs require a lock or a serialized queue.
4. **Attempt in parallel** — each lane may apply one focused, reversible candidate fix and run the same acceptance contract. A lane must not alter the acceptance test to manufacture success.
5. **Classify failures** — each lane emits a structured report: hypothesis, evidence, confirmed/suspected/disproved status, files changed, commands, exit codes, logs, and artifact links. Group common causes only when evidence supports the grouping.
6. **Retry boundedly** — on failure, diagnose the new failure and change the approach; do not repeat an unchanged command indefinitely. Default maximum is two retries per lane and a 20-minute lane timeout; adjust only with an explicit reason.
7. **Verify candidate** — a green build or diagnostic report is not a winner. Run the original acceptance check against the candidate SHA and verify its evidence independently. Real-chat tasks require a real non-mock answer; physical-device claims require physical-device evidence.
8. **Stop redundant work** — only after independent acceptance verification, request cancellation of redundant active lanes if the automation has permission. Preserve logs/artifacts first and record which cancellations were confirmed. If cancellation permission is absent, say so.
9. **Integrate safely** — cherry-pick/rebase only the verified candidate into a clean feature branch, run regression/security/architecture checks, and open/update a PR. Never merge or deploy just because a lane won.
10. **Report** — summarize elapsed time, parallelism, each hypothesis and result, common/different root causes, exact winning SHA, acceptance evidence, retries, cancellations, costs/rate-limit blocks, and what remains untested.

## Permission model (least privilege)

| Capability | Permission | Rule |
|---|---|---|
| Read source | `contents: read` | Default for diagnosis and test-only jobs. |
| Read run logs/artifacts | `actions: read` | Required for evidence collection. |
| Create candidate branches or commit fixes | `contents: write` | Grant only to a dedicated remediation job after branch protection and secret-safety checks. Never expose write credentials to untrusted fork PR code. |
| Open/update a PR | `pull-requests: write` | Separate integration job only; PR is the review boundary. |
| Cancel redundant runs | `actions: write` | Only after verified winner and evidence upload. |
| Deploy / publish | environment-scoped deployment permission | Not granted to diagnostic or candidate lanes. Require protected environment approval and all normal gates. |
| Call a model-based repair agent | provider credential stored as an Actions secret | Optional and explicit. Never print it, write it to artifacts, or expose it to untrusted code. Without this credential or a configured coding-agent service, automation can diagnose/report but cannot truthfully claim autonomous code generation. |

Do not use a broad personal access token when a narrowly scoped GitHub Actions token is sufficient. Repository owners must configure repository/org settings, secrets, protected environments, runner capacity, and any external model billing; a workflow file cannot grant itself repository-level permissions or create a missing secret.

## Required safety gates

- Preserve `main`, Live, and the original failing revision until a candidate is independently verified.
- No destructive cleanup or deletion of user data/files from a speculative hypothesis.
- Never share mutable workspaces between parallel lanes; avoid same-file write conflicts.
- Redact credentials and sensitive data from logs and reports.
- Keep concurrency bounded by runner capacity, Android device/emulator capacity, API quotas, and cost.
- Treat timeouts, missing logs, skipped tests, and missing artifacts as `BLOCKED` or `NOT TESTED`, never as pass.
- Do not automatically merge/deploy by default. Use a PR and the repository's normal required checks.
- Keep emulator, browser, and physical-device evidence separate.
- Store failed hypotheses and lessons so the next round does not repeat the same unhelpful experiment.

## Current implementation boundary

The existing Android triage workflow performs six concurrent **diagnostic** lanes and stores reports. That is useful first-stage automation, but it is not yet a fully autonomous repair-agent system: it does not independently generate six code patches, run competing fixes, select a winner, or cancel redundant remediation jobs. Those capabilities require an isolated remediation runner/agent, narrowly scoped write permissions, a defined acceptance command per task, and—if using an external model—a configured secret/service. Until those are present and end-to-end tested, report this boundary explicitly.

## Acceptance contract template

Every task must specify:
- one measurable user goal;
- exact acceptance command and pass criteria;
- prohibited side effects and regression checks;
- evidence required (logs, screenshots, output, APK hash/device identity as applicable);
- lane timeout and retry cap;
- permitted write paths and whether a real device or external service is required.

A lane may be called `WINNER` only when the original acceptance criteria pass against its exact candidate revision and the evidence is retained.