# Mosharrof Android AI Agent

## Product intent
A Bengali-first Android assistant inside Mosharrof AI. Mosharrof interprets requests and plans work; a paired Android companion performs only typed operations explicitly granted by the user. The web app alone cannot read or control a phone.

## Capability matrix
| Capability | Backend foundation | Additional requirement |
|---|---|---|
| Scheduled file organization | Scheduler + allowlisted handler | Companion, SAF/MediaStore grant, approved plan |
| Classify new downloads | MIME/extension classifier | Companion download/media event source; Android background limits apply |
| Daily phone health report | Metric normalizer + scheduler | Battery/storage/RAM telemetry; notification permission if notifying |
| Retry failed tasks | Bounded exponential retry | Trusted worker must invoke scheduler |
| Logs and Undo | SQLite history/audit + inverse-handler contract | Durable production DB and provider-specific rollback |
| Bengali AI assistant | Existing model-agnostic brain adapter | Intent schema, provider quota and safety evaluation |
| Screen-aware steps | Not enabled | MediaProjection consent; accessibility service only when explicitly enabled and policy-compliant |
| Multiple concurrent jobs | Bounded batch scheduler | Worker pool, per-device lock and rate limits before concurrency |
| Cloud backup/sync | Adapter boundary only | User-selected provider, OAuth, encryption, retention and restore tests |
| Offline local AI | Not enabled | Compatible on-device model, device checks and download consent |

## Device protocol
Use a narrow HTTPS API with device pairing, short-lived scoped credentials, expiry, nonce/replay protection, per-operation schemas, rate limits and append-only audit events. No general shell or arbitrary paths/commands. File access uses user-selected SAF trees or MediaStore. Destructive actions remain blocked by core policy.

## Operational contract
- Store schedule times in UTC and display local time.
- A missed schedule runs once on the next worker pass; do not replay every missed interval.
- Retries are bounded; a task pauses after the attempt limit.
- Use run IDs and idempotent handlers where possible.
- Undo only when a reversible token and trusted inverse handler exist.
- Disconnection, missing permission, stale credentials or provider failure must fail closed.

## Not yet live
No Android companion is installed or paired by this change. No relay, ChatGPT connector, cloud OAuth, screen capture, accessibility control or on-device model is deployed. Each requires separate implementation, deployment and real-device QA evidence.
