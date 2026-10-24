# Automation recovery and AI-assisted diagnosis

## Scope

This change adds reusable, provider-agnostic recovery primitives. It does **not** yet wire a supervisor into Mosharrof's production/browser runtime or Android app. A durable host (system service, scheduled workflow, or backend worker) must call the watchdog periodically; a watchdog cannot restart its own host after that host is terminated.

## Components

- `Supervisor.tick()`: heartbeat result, bounded restart attempts, exponential backoff, and explicit manual-intervention state.
- `save_checkpoint()/load_checkpoint()`: atomic local JSON checkpoint writes and fail-closed parsing.
- `RuleBasedAdvisor`: local deterministic incident classification.
- `AIIncidentAdvisor`: optional AI adapter interface. A real approved model callback must be configured to enable model-backed advice. Otherwise it clearly reports `AI_NOT_CONFIGURED` and uses local rules.
- Redaction of common API-key/token/password and Bearer-shaped strings before optional AI transmission.

## Required integration before production

1. Choose the actual Mosharrof worker/service process and define a real health signal.
2. Run the supervisor from an independent host/scheduler with least-privilege restart permission.
3. Store checkpoints in durable, access-controlled storage with schema/version validation.
4. Configure an approved AI endpoint and secret store; verify the provider call and redact/limit incident data.
5. Add deployment-specific integration tests and fault-injection tests (process kill, network loss, repeated crash, corrupt checkpoint).
6. Keep retries bounded; auth/permission failures and quota errors need remediation/backoff, not endless restarts.
7. Emit structured status metrics/logs and alert when manual intervention is required.

## Verification

Run: `python -m unittest tests.test_automation_supervisor -v`

Unit tests cover bounded retries, backoff, health reset, checkpoint corruption, and AI adapter fallback. They do not prove production restart, live model access, Android physical-device behavior, or deployed service health.
