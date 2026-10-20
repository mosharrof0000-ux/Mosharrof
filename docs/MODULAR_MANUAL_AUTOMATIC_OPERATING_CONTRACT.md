# Modular Manual + Automatic Operating Contract

Status: proposed architecture contract. This document does not claim that automation is implemented or active.

## Goal

Every Mosharrof AI feature is an independently identifiable module ("organ") with its own responsibility, files, capability declaration, permissions, tests, health state, audit trail, and lifecycle. Every eligible module supports both manual operation and policy-controlled automatic operation. The whole ecosystem can later be coordinated by an orchestrator without merging module responsibilities or bypassing safety.

## Non-negotiable module boundary

Each module must declare:

- Stable `entity_id`, owner, responsibility, input/output contract, version, and dependencies.
- A dedicated folder or clearly bounded package; avoid unrelated feature logic in the same file.
- Capability manifest: supported actions, provider/model requirements, health checks, resource/cost limits, and fallback behavior.
- Permission profile and scope; no child module may expand its own authority.
- Unit, integration, failure-path, and relevant UI/end-to-end tests.
- Health/readiness endpoint or equivalent machine-readable status, audit events, and a recovery strategy.
- Manual and automatic execution paths that call the same validated service layer rather than duplicate business logic.

## Two operation modes

### Manual mode
- User explicitly chooses the action, provider/model, and applicable settings.
- Show the active configuration, expected effect, and result.
- Ask for confirmation for external, costly, privacy-sensitive, or irreversible actions.
- Manual mode remains available when the orchestrator is paused, subject to the same permission policy.

### Automatic mode
- Each module declares which tasks may run unattended and which require approval.
- Tasks use a durable queue/job record with unique ID, status, timestamps, attempts, timeout, idempotency key, and result/evidence links.
- Retry only allowlisted transient failures with bounded attempts and backoff; never retry unsafe actions blindly.
- Validate prerequisites, credentials, quotas, cost ceilings, scope, and health before execution.
- Emit audit records and a resumable checkpoint; after interruption, recover from the last verified checkpoint.
- Automatic mode must not bypass tests, approval gates, data-consent requirements, or global policy.

## Central orchestrator

The orchestrator coordinates modules but does not absorb their implementation. It should:

1. Read the project manifest and entity/capability registries.
2. Build a dependency graph and select only registered, healthy, authorized modules.
3. Plan a task DAG with explicit inputs, outputs, prerequisites, budgets, and stop conditions.
4. Dispatch work through each module's stable interface.
5. Verify outputs independently; distinguish planned, running, blocked, failed, and verified states.
6. Retry eligible failures, route to a declared fallback, or pause with an actionable reason.
7. Persist checkpoints, evidence, and an operator-readable final report.

## State model

Use explicit states: `DRAFT`, `READY`, `RUNNING`, `BLOCKED_APPROVAL`, `BLOCKED_CONFIG`, `RETRY_WAIT`, `FAILED`, `VERIFYING`, `VERIFIED`, `PAUSED`, `CANCELLED`.

A task is not complete merely because a command returned success. It becomes `VERIFIED` only after required postconditions and tests pass and evidence is recorded.

## Safety, privacy, and control

- Preserve the existing global rules: deletion/destructive operations and scope escape remain blocked unless an explicit, reviewed policy change authorizes a narrowly defined safe operation.
- No secrets in browser code, commits, logs, screenshots, or task summaries.
- Personal voice/audio, recordings, and cloned voices require explicit, revocable consent, owner-scoped access, retention/deletion controls, and provider-compatible consent checks.
- Automatic execution is opt-in per module and task class. Provide global pause/kill switch, per-module pause, dry-run, budget limits, and audit review.
- Never auto-merge or deploy if required CI, security, compatibility, or live smoke checks fail.
- Human approval remains mandatory for privilege changes, public deployment when policy requires it, spending beyond an approved budget, and privacy-sensitive enrollment.

## Required module contract

A registered module should expose equivalents of:

- `describe()`: identity, version, capabilities, dependencies, operation modes.
- `health()`: readiness and safe diagnostic reason.
- `validate(task)`: input, permission, consent, quota, and prerequisite checks.
- `run_manual(task, actor)`: validated manual execution.
- `run_auto(task, policy_context)`: validated unattended execution.
- `verify(task, result)`: independent postcondition checks.
- `recover(task_id)`: resume only from a verified checkpoint.
- `pause()/resume()`: safe state transitions.
- `audit_event()`: redacted, structured evidence.

These are design-level interface names; they must be mapped to the project's existing conventions before implementation.

## Rollout plan

1. Inventory current modules, workflows, registries, permissions, and existing automation; do not duplicate working components.
2. Define a schema and validate every entity/capability registry entry in CI.
3. Add a module-conformance test: dedicated boundary, manual path, auto path, permission checks, health, audit, failure handling, and tests.
4. Build a read-only orchestrator first: discover modules, report readiness, and produce a dry-run plan without executing changes.
5. Add a durable job ledger, checkpoints, allowlisted retries, and safe scheduling.
6. Integrate one low-risk pilot module; compare manual and automatic outcomes.
7. Expand module by module only after evidence passes; keep current Live/main protected by PR and deployment gates.

## Acceptance criteria

- Every registered feature maps to one explicit module owner and bounded code location.
- Manual and automatic modes share validated business logic and enforce identical permissions.
- Missing folders/contracts/tests or undeclared dependencies block activation in CI.
- Every automatic run has a durable status, checkpoint, audit trail, and evidence link.
- Interrupted jobs resume safely without duplicate side effects.
- Failure, quota exhaustion, missing secrets, unsupported capability, and provider outage produce truthful blocked/fallback states.
- No module can silently bypass global policy or claim verification without passing its postconditions.
- Existing Live behavior remains unchanged until the pilot is reviewed, tested, approved, and deployed.
