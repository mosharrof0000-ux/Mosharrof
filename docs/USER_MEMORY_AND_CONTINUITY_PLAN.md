# MOSHARROF AI — User Memory, Continuity, and Safe Background Voice Plan

Status: phased implementation plan; not a claim that all features are already available.

## Immediate continuity fix

- Keep the existing chat-session history.
- Send only the last 12 prior turns with each chat request.
- Bound prior-turn context to 6,000 characters in the Worker and cap each turn.
- Apply the same context to Gemini, Cloudflare Workers AI, Groq, and OpenRouter.
- Never send API credentials or other secrets in conversation context.
- Keep the current user turn separate from prior history to avoid duplicate prompts.

## Memory layers

1. **Conversation context:** recent turns from the active chat, used to resolve references such as “আগের কথাটা”.
2. **Cross-chat retrieval:** search prior saved conversations on the device for relevant excerpts, with user controls to exclude chats or clear history. Do not silently treat every old statement as current truth.
3. **User-approved memory:** explicit facts, preferences, goals, project state, and follow-up commitments. Every item should record source, timestamp, confidence/status, and whether the user approved it.
4. **Timeline and life history:** dated events and changes in plans or views. Store the user's stated reasons separately from any model interpretation; support correction, export, and deletion.
5. **Work ledger:** command, consent decision, action actually performed, result, evidence, failure, and next step. Never mark a proposed action as completed.
6. **Speaker-specific memory:** keep identities and memories separate only after a user-controlled enrollment/consent flow. Do not infer a real identity from voice alone.

## Privacy and safety requirements

- Recording is off by default. Starting or stopping it must be available through visible controls and supported voice/text commands.
- Show an unmistakable recording indicator and a persistent stop control while capture is active.
- Do not record bystanders or create voiceprints/memories about other people without their informed consent.
- Explain what is saved, where it is saved, how long it is retained, and how to inspect/export/delete it.
- Keep each user's data isolated. Local browser storage alone is not a multi-user identity system; before cloud sync, implement authentication, authorization, retention controls, and tenant-isolation tests.
- Do not store sensitive traits or infer mental-health states. Describe changes in thinking only from statements the user actually made.
- Ask before consequential device actions; verify results and report failures honestly.

## Update strategy

- Web UI and Worker source changes are delivered by their existing deployment workflows after reviewed PRs are merged; no new API key or APK is inherently needed for a code-only web change.
- The current Android APK may embed web assets. Confirm its Capacitor packaging/update strategy before promising APK-free updates.
- Prefer automatic web/PWA updates where supported. Native Android capabilities still require a signed app update unless a separately reviewed, secure update mechanism is in place.
- Do not deploy Worker changes or change the live main branch from this draft PR. Run tests and review first.

## Phases and acceptance criteria

- **P0 — Recent chat continuity:** prior turns reach every configured provider; tests prove bounds, role filtering, and no duplication of the current turn.
- **P1 — Cross-chat retrieval:** relevant past conversations can be found and included with a strict size limit; user can inspect what was retrieved.
- **P2 — Approved profile memory and timeline:** add/edit/forget/export controls; provenance and timestamps; corrections override stale facts without erasing history.
- **P3 — Reliable work history:** persistent action ledger with explicit pending/succeeded/failed states and evidence.
- **P4 — Voice capture:** opt-in, visible foreground/background service where Android permits it, consent gates, explicit retention, and stop controls.
- **P5 — Speaker profiles:** opt-in enrollment, confidence thresholds, no identity guessing, separate per-person access rules, and deletion support.
- **P6 — Multi-device sync:** authenticated server-side storage with per-user isolation and recovery; do not use a shared unauthenticated Worker store for personal memories.

## Definition of done

Each phase has regression tests, privacy/security checks, a reviewable PR, deployment verification, a rollback path, and a user-facing change note. Keep live/main untouched until the required checks pass and promotion is approved.
