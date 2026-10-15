# MOSHARROF Organ Reliability, Scale, and Self-Repair Policy

## Goals

Keep organ boundaries explicit, keep each production file small, prevent one organ's failure from taking down unrelated features, and support safe operation as concurrent users grow. This policy is a design and release contract; it does not claim that the legacy app has already been migrated or that autoscaling/self-repair is already deployed.

## Module and file budgets

- Each organ lives at `organs/<organ-id>/` and owns `organ.json`, `index.js`, `README.md`, and `tests/README.md`.
- Keep production source under `organs/<organ-id>/` or `core/`; do not keep growing the frozen legacy shell `web/index.html`.
- Hard per-file line budgets enforced by the architecture gate: JS/TS 250, CSS 350, HTML 300, JSON 200. Split by responsibility before exceeding a limit.
- Cap declared imports/resources at 20 per production file. A helper module must obey the same budgets; splitting must not simply move an oversized dependency list into another oversized file.
- Organs may communicate only through versioned, declared public APIs or validated messages. Never import another organ's private implementation.
- Keep runtime manifests deterministic and validate IDs, dependencies, API versions, and schema compatibility at build time.

## Runtime isolation and performance

1. Keep request handlers stateless where possible; store durable state in explicit storage services rather than worker memory.
2. Put hard timeouts and cancellation on every network/model/storage call. Bound payload size, concurrency, queue depth, and memory/CPU use.
3. Use bounded retries with exponential backoff and jitter. Do not retry non-idempotent writes unless an idempotency key protects them.
4. Add circuit breakers and bulkheads per provider/organ so a slow model or voice provider cannot consume all capacity for chat or other organs.
5. Move long-running work (voice generation, research, large file processing, repair jobs) to asynchronous queues. Acknowledge work, persist job status, retry safely, and route exhausted jobs to a dead-letter queue for diagnosis.
6. Cache only safe, correctly scoped data. Include tenant/user scope in cache keys where relevant; never allow one user's private response to leak to another.
7. Enforce authentication, authorization, rate limits, quotas, request validation, and tenant isolation on the server—not only in the UI.
8. Version public APIs and event schemas. Use additive changes first, compatibility tests, and a deprecation window before removing old contracts.
9. Measure per-organ request rate, p50/p95/p99 latency, error rate, timeout rate, queue age/depth, provider quota, and saturation. Set explicit service-level objectives and alert on budget burn.
10. Test realistic concurrency and load before increasing rollout. Autoscaling needs capacity limits, queue back-pressure, and cost/quota alerts; scaling alone does not fix a slow dependency.

## Safe self-refinement and repair loop

`Observe -> Diagnose -> Reproduce in sandbox -> Propose patch -> Test -> Security scan -> Review/PR -> Canary -> Verify metrics -> Promote or rollback`

- Monitoring may automatically open an incident and notify MOSHARROF with a redacted summary, organ ID, build/version, evidence, severity, and suggested next action.
- The repair agent gets a short-lived, least-privilege identity only for its assigned task. It must not read or print secrets, mint broader credentials, change its own policy, or cross tenant boundaries.
- Pre-authorize a narrow class of reversible, low-risk actions so they do not require a repeated human prompt: retry a failed idempotent job, clear a scoped non-sensitive cache, restart a disposable worker, open an issue, create a feature branch, or run tests.
- Code repair may be generated automatically in a sandbox and committed to a branch/PR if the GitHub role permits it. Require tests, static/security checks, dependency checks, and a diff summary.
- Do not let an AI agent directly change production secrets, permissions, billing, tenant/user data, access controls, data deletion, or the live deployment policy without a separately approved, auditable authorization. Do not auto-merge a repair merely because tests pass.
- Deploy with feature flags and a small canary where the platform supports it. Automatically stop promotion and roll back when predeclared health thresholds are breached. Keep the last known-good artifact and a tested recovery path.
- If diagnosis is uncertain or a repair fails twice, stop the repair loop, preserve evidence, notify MOSHARROF, and avoid unbounded retries or repeated speculative edits.

## Release and live-site protection

- Keep all architecture work on a feature branch and PR; do not edit `main` or deploy from a feature branch.
- CI must fail closed for missing/empty `organs/`, invalid manifests, missing required files, oversized files, more than 20 links, undeclared dependencies, and cross-organ private imports.
- Run unit, integration, contract, accessibility/visual, security, and load checks appropriate to the change. A passing unit test is not proof of live readiness.
- Separate deploy from release: deploy disabled code behind a feature flag, then enable gradually after health checks.
- Preserve deployment provenance, a backup/checkpoint, an auditable change log, and a documented rollback procedure.
- Never claim thousands of concurrent users are supported until a representative load test and capacity report demonstrate it.

## Permission model

"Automatic" means policy-preauthorized within a narrow scope—not unrestricted authority. Low-risk recovery and diagnostics can run without asking each time. Any action that changes production behavior, expands access, changes secrets/permissions, or can affect users' data requires a separate authorization gate. This prevents a self-repair agent from becoming a self-privileging production administrator.

## Current implementation boundary

The architecture gate and registry/scaffolder are in PR #588. The actual production UI migration into organ folders is still outstanding; the legacy shell and live Pages must remain unchanged until the migrated app passes all gates and end-to-end verification.
