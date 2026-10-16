# MOSHARROF AI — User Memory, Continuity, and Safe Background Voice Plan

Status: phased implementation plan; not a claim that all features are already available.

## Immediate continuity fix

- Keep the existing chat-session history.
- Implemented in the current Worker: send up to the last 12 prior turns with each chat request.
- Cap each prior turn at 900 characters and bound combined prior-turn context to at most 6,000 characters, while keeping the full request within a 12,000-character limit.
- Apply the same context to Gemini, Cloudflare Workers AI, Groq, and OpenRouter so failover preserves conversation context.
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

## Personalization and safe improvement loop

MOSHARROF must not claim that it secretly retrains its underlying AI model. The model provider controls model-weight updates. MOSHARROF can improve its usefulness for each person through a controlled application-level loop:

1. **Observe only permitted inputs:** current conversation, saved chats the user allows it to reference, explicit feedback, and approved app events.
2. **Retrieve context:** search for relevant prior messages and approved memories before answering; attach dates and sources so old plans are not mistaken for current ones.
3. **Maintain a profile:** preferences, communication style, active goals, accessibility choices, projects, and follow-up commitments. Store user-stated facts separately from hypotheses.
4. **Resolve change over time:** when a new statement conflicts with an older one, keep both in the timeline, mark the older item as superseded, and ask for clarification when the difference matters.
5. **Learn from feedback:** use likes/dislikes and corrections to adjust response preferences, not to silently change factual memories or train a model without a clear policy and consent.
6. **Check its own work:** run tests, validate tool results, record evidence, classify failures, and propose a patch or task. Code changes must go through branch, review, tests, and explicit promotion; never let an agent rewrite live/main directly.
7. **Proactive assistance:** offer reminders, follow-up questions, or advice only when the user enables a category and schedule/trigger. Show why a reminder was suggested and provide snooze, edit, disable, and delete controls.

## Notifications and background awareness

- Background monitoring is a separate, opt-in feature; it is not always-on by default.
- Support a visible, persistent state such as Off / Listening / Paused, plus an immediate stop control and a record of when capture started/stopped.
- For reminders, prefer explicit user-defined times and goals. Any AI-suggested reminder must be a proposal until the user approves it.
- Use Android's supported foreground-service and notification rules for microphone use. If the OS stops the service, report that honestly instead of claiming continuous listening.
- Do not interpret silence, voice tone, facial expression, or limited chat evidence as a diagnosis or certain statement about a person's mood. Phrase emotional impressions as tentative and invite correction.
- Identify speakers only with explicit enrollment and consent; never silently build voiceprints or infer the identity of a new person. Keep each participant's notes separate and let them inspect and delete their own data.
- Notifications should be helpful, low-frequency, quiet-hour aware, and easy to turn off. Avoid shame, coercion, or manipulative language.

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
- **P7 — Proactive support:** user-defined goals, opt-in reminders, quiet hours, notification rate limits, evidence-linked suggestions, and snooze/disable controls.
- **P8 — Quality-improvement loop:** privacy-reviewed feedback analytics, regression tests for repeated failures, provider/model version tracking, and reviewed code changes. This improves the product's workflow and personalization; it does not mean the running model autonomously retrains itself.

## Definition of done

Each phase has regression tests, privacy/security checks, a reviewable PR, deployment verification, a rollback path, and a user-facing change note. Keep live/main untouched until the required checks pass and promotion is approved.
