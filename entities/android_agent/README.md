# Android AI Agent & Automation

Mosharrof-owned orchestration for an optional, user-paired Android companion. This entity does not imply that the website can directly access a phone.

## Implemented foundation
- SQLite-backed automation definitions, due-run execution, bounded exponential retries, pause/resume, run history and audit events.
- Allowlisted handlers only; no shell, arbitrary code, arbitrary URL, or destructive command execution.
- Reversible actions only when a registered inverse handler and explicit undo payload exist.
- Download categorization suggestions and a phone-health report normalizer.

## Delivery phases
1. Files/media: Android companion uses Storage Access Framework or MediaStore grants; index, classify and preview organization. Never auto-delete.
2. Device health/control: permitted battery/storage/RAM telemetry; screen capture requires Android MediaProjection consent; usage data requires Usage Access; typed app actions only.
3. AI automation/connectivity: Bengali intent planner, schedule manager, bounded workers, cloud backup/sync adapter and optional local model. ChatGPT requires an authenticated, explicitly configured connector/relay.

The scheduler is invoked by a trusted worker or scheduled workflow through the Python API. Register only application-owned handlers. It is not a resident background service by itself. Device operations remain unavailable until a companion is installed, paired and granted permissions.

Read-only by default. No silent deletion, arbitrary remote shell, permission bypass, or lock-screen/OTP/banking interaction. Undo exists only where a trusted inverse handler is registered and the Android provider supports rollback.
