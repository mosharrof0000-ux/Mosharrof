# MOSHARROF AI — Unified AI Conversation & Style Memory Bridge

Status: design proposal only. This document does not claim direct access to ChatGPT, Gemini, Groq, or other providers' private conversation stores. Provider access must use an official API/connector, user-authorized export/import, or a user-enabled browser extension where legally and technically permitted.

## Goal

Let the user maintain one portable, inspectable memory and style guide across Mosharrof AI and supported AI providers. Capture only conversations the user explicitly authorizes, preserve source/provider/time metadata, and retrieve relevant excerpts when answering or generating designs.

## Existing foundation to reuse

- core/personal-memory-engine.js: local-first IndexedDB memory, folders, search, timeline, import/export, enabled toggle.
- core/personal-memory-bridge.js: connect saved memory to Mosharrof's own live chat.
- docs/USER_MEMORY_AND_CONTINUITY_PLAN.md: memory layers, privacy, current-vs-old instruction priority, work ledger.
- Existing browser smoke tests: verify save/reload/recall.

Do not create a second competing memory database. Extend the existing engine with provider adapters and a shared schema.

## Architecture

1. **Canonical conversation schema**
   - conversation_id, provider, provider_conversation_id (when available), role, content, created_at, source_url, capture_method, consent_scope, import_batch_id, content_hash, retention_state.
   - Keep user statements, assistant replies, extracted preferences, inferred summaries, and task evidence as distinct record kinds.
   - Store exact source text separately from derived summaries. Derived memories must point back to source turns.

2. **Provider adapter interface**
   - capabilities(): declare supported operations without guessing.
   - connect(): official OAuth/API authorization when offered.
   - importExport(file): parse user-provided conversation exports.
   - captureApprovedTurn(turn): accept only an explicitly authorized turn from a supported integration.
   - disconnect(), syncStatus(), deleteImportedBatch(id).
   - Provider-specific adapters must be isolated in their own files/modules; secrets remain server-side and are never written to browser memory or logs.

3. **Connection methods, in priority order**
   - **Official provider API / connector:** only where it actually supports conversation retrieval or event sync; document limits per provider.
   - **User export/import:** accept provider data exports, validate format, preview counts, deduplicate, then ask before importing.
   - **Opt-in browser extension:** only for pages and fields the user explicitly enables; visible capture status, pause/stop, domain allowlist, exclude selectors, and no password/secret fields. Respect provider terms, browser security boundaries, and applicable law.
   - **Manual paste/share:** fallback when a provider offers no supported full-history API or export. Never claim that a provider is fully synced unless measured evidence proves it.

4. **Portable style and design guide**
   - Store user-approved style rules as structured, editable records: explanation style, Bengali/English preference, table conventions, heading hierarchy, icons, spacing, color/contrast, UI component patterns, and code/design examples.
   - Treat observed ChatGPT/Gemini output as examples to learn from, not a license to copy proprietary hidden prompts, private internal reasoning, or inaccessible system instructions.
   - Generate a reusable MOSHARROF_STYLE_GUIDE.md and machine-readable style profile; cite the source examples and allow correction/deletion.
   - Learn only from outputs and interactions the user is allowed to provide. Do not pretend to know hidden model reasoning or undisclosed system prompts.

5. **Retrieval and response assembly**
   - On a new Mosharrof chat turn, retrieve a bounded set of relevant approved memories and source excerpts.
   - Apply current user instructions first; older preferences are defaults, not overrides.
   - Include provider, date, and source link in internal metadata; do not send irrelevant entire history to providers.
   - Do not automatically forward a user's ChatGPT conversation to Gemini/Groq/OpenRouter or vice versa. Cross-provider sharing requires a clear opt-in scope and visible destination.

6. **Security, privacy, and control**
   - Per-provider enable/disable, per-domain allowlist, per-conversation exclusion, pause, export, batch deletion, full deletion, retention settings, and sync audit.
   - Explicit consent before first capture/import and before cross-provider forwarding.
   - Encrypt any cloud-synced content in transit and at rest; authenticate users and enforce tenant isolation. Browser-only IndexedDB is local to that browser profile/device and is not cross-device cloud sync.
   - Redact credentials, access tokens, passwords, payment data, and other secrets before storage. Keep sensitive personal categories out of automatic inferred profile records.
   - Log only metadata and outcome, not full private content, in CI or diagnostics.
   - If provider access expires, quota is exhausted, or a connector is unavailable, report BLOCKED/partial sync honestly.

## Implementation milestones

### M1 — Audit and schema (safe, no live capture)
- Inventory the existing engine and test its initialization on the deployed Pages artifact.
- Add schema/version migration and a fake-provider adapter contract test.
- Add explicit source and consent metadata.
- Acceptance: current memory features remain compatible; no provider connection is claimed.

### M2 — Export/import (first usable cross-provider path)
- Implement one provider-neutral import pipeline with preview, validation, deduplication, bounded batch sizes, rollback, and an import report.
- Start with user-supplied exports whose documented format can be validated.
- Acceptance: sample fixture imports, reload persists records, duplicate import creates no duplicates, export round-trip works, deletion removes the chosen batch.

### M3 — Provider adapter registry
- Add isolated adapter modules only for providers with confirmed supported APIs/connectors.
- Expose per-provider capability/status and clear failure reasons.
- Acceptance: contract tests for success, revoked consent, unavailable provider, rate limit, and partial sync.

### M4 — Optional browser capture
- Prototype an opt-in browser extension only after review of browser permissions, provider terms, and a minimal allowlist design.
- Visible recording/capture badge and one-action pause/stop; never capture unrelated tabs by default.
- Acceptance: tests prove excluded domains/fields are not stored; no stealth or background universal interception.

### M5 — Style learning and continuity
- Extract editable style rules from user-selected examples and approved chats.
- Keep source quotes, derived rule, confidence, and approval state distinct.
- Acceptance: generate the same style guide across sessions, show source provenance, and honor edits/deletions.

### M6 — Live and multi-device verification
- Test the deployed Mosharrof Pages site, Android WebView, local persistence, import/export, and each supported provider independently.
- Add authenticated cloud sync only as a separate reviewed phase.
- Acceptance: evidence artifacts per platform/provider; physical-device testing must be reported separately from emulator testing.

## Non-goals / hard boundaries

- No secret access to ChatGPT, Gemini, Groq, or any other account's private chat database.
- No guarantee of full history capture where a provider exposes no supported API/export and the user has not enabled an approved capture path.
- No collection of hidden chain-of-thought or private system/developer prompts.
- No automatic sharing to third-party model providers without informed user opt-in.
- No direct edits to main or live files; implementation goes through isolated branch, tests, review, and normal release workflow.

## Definition of done

The feature is done only when a user can inspect which provider/source was connected, see exactly what was imported/captured, pause or disconnect it, search across permitted memories, export/delete data, and verify round-trip persistence. Each provider and platform receives its own evidence; a green generic CI job is not proof of every integration.