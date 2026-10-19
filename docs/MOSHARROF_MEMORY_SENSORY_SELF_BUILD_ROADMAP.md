# MOSHARROF Memory, Sensory and Incremental Self-Build Engine

Status: roadmap for staged implementation; not a claim that all capabilities are implemented or enabled.

## Objective
Build MOSHARROF as a continuity-aware assistant that can remember user-approved context, understand permitted device observations, use available sensors when explicitly enabled, and improve its application through a persistent, test-driven work queue. Existing chat, provider reliability, Android automation and release work must continue; this roadmap is an additional lane, not a replacement for the active backlog.

## Current known foundation
- core/personal-memory-engine.js provides local chronological memory, topic folders, search, timeline, export/import and preference-aware context.
- core/personal-memory-bridge.js connects saved memory to chat context and adds memory controls.
- core/android-agent-memory.js and core/android-agent-memory-ui.js provide a separate consent-gated local memory surface for the Android-agent experience.
- docs/USER_MEMORY_AND_CONTINUITY_PLAN.md defines consent, data isolation, speaker identity and safe improvement rules.
- docs/ANDROID_DEVICE_AUTOMATION_ROADMAP.md defines device bridge, observation/action adapters, verification and release gates.
- Existing pieces may overlap but must not silently be treated as one unified, fully verified memory system. First map wiring and test coverage.

## Capability roadmap

### M0 — Inventory, continuity and recovery
- Produce a machine-readable capability registry: capability ID, owner organ, source files, status (planned/in progress/implemented/verified/blocked), permissions, tests, evidence, last checked commit and next step.
- Reconcile duplicate memory implementations; document which UI calls which engine and where each store persists.
- Add a durable work ledger with task ID, start checkpoint, latest checkpoint, failure reason, retry policy, artifact links and resume command.
- Ensure a green workflow with no real work is labelled NO_WORK or SKIPPED, never reported as task completion.
- Acceptance: tests prove interrupted tasks can resume from a checkpoint without redoing completed work or skipping failed verification.

### M1 — User-approved memory
- Store user instructions, preferences, decisions, corrections, project state, open tasks and outcomes with timestamps, source/session IDs, tags, confidence and lifecycle state.
- Organize by project/topic folders and timeline; distinguish direct user statements from assistant inference.
- On conflict, retain the older item as superseded and prioritize the current instruction.
- Add duplicate detection, explicit remember/do-not-remember commands, per-item edit/delete, export/import and retention controls.
- Retrieve only relevant memories into the prompt with a strict context budget; do not send all stored history to every provider.
- Default to local storage. Cloud sync requires authenticated accounts, authorization, encryption, retention policy and tenant-isolation tests.
- Acceptance: reload/restart recall, folder filtering, conflict handling, delete/export, secret filtering and current-turn priority all pass automated tests.

### M2 — Recording and voice
- User-initiated microphone capture only; recording defaults off.
- Show a persistent recording indicator, elapsed time, storage notice and one-action stop/pause control.
- Allow explicit transcription or summarization; ask before saving a transcript as long-term memory.
- Provide processing disclosure, size limits, delete controls and cleanup after failure.
- Do not continuously record bystanders, identify unknown speakers, or create voiceprints. Speaker-specific memories require separate informed enrollment and revocation.
- Respect Android foreground-service and notification rules; if the OS stops capture, report it accurately.
- Acceptance: permission denied/revoked, screen locked, app backgrounded, interruption, low storage and stop/resume tests.

### M3 — Camera and visual understanding
- Camera use is foreground, user-initiated and visibly indicated; never covertly capture images.
- Support explicit actions: analyse this photo, read visible text, identify objects, summarize a document, organize selected photos into user-chosen folders, and translate titles into Bengali.
- Preview before saving, redact sensitive regions where feasible, preserve originals unless asked to edit, and ask before sharing/uploading.
- Prefer on-device OCR/classification where practical; disclose when a selected image leaves the device for a vision provider.
- Do not perform face recognition or identify people without a legitimate, consent-based and reviewed feature design.
- Acceptance: camera permission states, no-camera device, blurry/rotated images, Bengali OCR, network failure, cancellation and verified file placement.

### M4 — Device and environmental sensors
- Capability adapters may read supported sensors such as accelerometer, gyroscope, proximity, light, step counter, battery and charging state only when relevant and permitted.
- Sensor data is not a diagnosis or proof of intent. Show what is sampled, why, sampling frequency, retention and stop controls.
- No hidden background tracking. Location, activity recognition and continuous sampling need separate explicit opt-in and Android-compliant operation.
- Useful user-triggered tasks: detect device orientation, summarize battery/charging, infer screen proximity behavior, or report step counts when hardware supports them.
- Acceptance: unavailable permissions, unsupported hardware, throttling, battery impact, background limits and data deletion tests.

### M5 — Screen and app understanding
- Prefer Accessibility/UiAutomator semantic hierarchy, resource IDs and labels; use screenshots/OCR only when needed and authorized.
- Redact passwords, OTPs, private messages and payment data from logs and artifacts.
- Every action must have preconditions, timeout, expected postcondition, cancellation and rollback/recovery where possible.
- Ask for confirmation before sending messages, deleting files, changing security settings, purchases, calls or other consequential actions.
- Acceptance: emulator E2E evidence; physical-device success is claimed only after an owner-authorized device actually runs the test.

### M6 — Incremental self-build / work coordinator
- A persistent coordinator scans the backlog on configured schedules and after relevant CI failures; scheduled background activity is opt-in and has visible status.
- Each run selects one small, dependency-ready task, records why it was chosen, creates or resumes a feature branch, changes only the relevant organ, runs focused tests then regression gates, and opens/updates a PR with evidence.
- Enforce a single-writer lock per workstream, task deadlines, retry limits, rate limits, cancellation, duplicate-task detection and checkpoints.
- Never write directly to main or publish a release just because a generated patch passes a local check. Merge/deploy follows repository policy and required green checks.
- On quota/rate-limit/network failure, record a blocked state, backoff and retry later; do not loop endlessly or falsely report success.
- Every run reports current task, completed tasks, blocked tasks, next task and links to PR/Actions artifacts.
- Acceptance: interrupted-run recovery, concurrent-trigger collision, failed-test stop, no-op workflow status, backlog ordering and safe rollback tests.

### M7 — Personalized application-level improvement
- Learn response preferences from explicit corrections, ratings and approved examples; do not silently alter factual memories.
- Evaluate changes against regression tests covering Bengali responses, provider fallback, memory retrieval, permissions and privacy.
- Track latency and success by provider using actual measurements; apply bounded timeouts, retry budgets and circuit-breaker/backoff logic.
- The app can improve prompts, retrieval, routing and code through reviewed changes. It must not claim to retrain hosted model weights unless an authorized training pipeline exists.
- Acceptance: measurable before/after results, source-linked metrics, rollback path and no regressions in safety/privacy tests.

## Shared status vocabulary
- PLANNED: not started.
- IN_PROGRESS: a recorded run is active.
- BLOCKED: an explicit dependency or failure prevents progress.
- IMPLEMENTED: code exists but is not yet fully verified.
- VERIFIED: required tests and evidence passed for a stated environment.
- DEPLOYED: release workflow succeeded and the deployed revision was independently checked.
- NO_WORK: no eligible task was available; not a success claim for a requested task.

## Non-negotiable safeguards
- No hidden recording, camera use or continuous sensor monitoring.
- Permissions remain user-controlled and revocable.
- Do not store credentials, OTPs, payment secrets, raw private screen captures or inferred sensitive traits in memory.
- Preserve user data by default; never uninstall/erase real-device data without explicit approval and a backup plan.
- Keep each capability in a small, separately owned module with tests and documented dependencies.
- Preserve active provider-fallback/live-verification work and existing release gates while implementing these phases in small PRs.
