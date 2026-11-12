# Personal Voice System

This organ extends the existing **Read Aloud** action; it does not add a separate page or toolbar button.

## Product contract

- Keep the existing MOSHARROF TTS Worker and Gemini voice available. Gemini remains a selectable provider and the safe fallback when a selected non-Gemini provider fails.
- Expose voice profiles, provider voices, and the licensed voice catalog from the existing Read Aloud menu.
- A profile is registered once and reused. Its permanent serial is assigned by an authenticated server-side allocator (for example, `VOICE-001`); serials are never recycled, including after deletion. The browser must never allocate authoritative serials.
- Support multiple profiles per owner, per-message voice choice, a default profile, rename/edit, preview/test, and deletion.
- Show only controls the selected provider actually supports. Do not silently pretend pitch, emotion, pauses, or intensity are supported.
- Search the catalog by name, language, and style; show preview, provider availability, and license/consent status before saving.
- A catalog listing is not permission to clone a real person's voice. Cloning requires proof of ownership or explicit authorization and separate consent for sample use, improvement/training, and retention.
- Audio samples and generated voice assets must remain private, encrypted at rest, owner-scoped, excluded from logs, and deletable. No sample is requested until the setup UI and secure upload path are ready.

## Architecture boundary

- `domain/`: provider-neutral profile, consent, serial, and capability contracts.
- `server/migrations/`: D1 schema for owner-private profiles, consent, preferences, catalog metadata, and an AUTOINCREMENT serial ledger. The ledger is deliberately separate so deleted profile serials are never reused.
- `providers/`: provider adapters. The Gemini adapter must preserve the existing Gemini TTS request behavior.
- `catalog/`: searchable provider-backed voices with explicit license and availability metadata.
- `service/`: authenticated server API boundary; no browser-side secrets or authoritative profile storage.
- Existing `organs/message-audio` remains the integration point for the Read Aloud menu and message action.

## Delivery gates

1. Domain and capability contracts with tests.
2. Authenticated owner-scoped profile API, persistent non-recycled serial allocator, encrypted private sample storage, revocation/deletion.
3. Consent and sample-registration UI inside the Read Aloud menu.
4. Provider adapters and licensed catalog search/preview.
5. Read Aloud integration, Gemini preservation and fallback, per-message/default profile selection.
6. Provider-specific controls, accessibility, security tests, Bengali quality tests, and live browser/device verification.

## Infrastructure prerequisites and current status

The D1 migration is a schema artifact only. It has not been applied to a Cloudflare database, and no D1/R2 bindings, Supabase JWT verification configuration, or voice-encryption secret are present in this PR. The existing TTS Worker does not yet expose personal-voice routes. Do not enable profile creation or request a sample until those server controls and private-storage checks are deployed and verified.

This branch starts with the domain contract and database schema. It does **not** claim that cloning, storage, catalog search, or UI is live yet. The earlier PRs #525–#527 are prior groundwork and must be reconciled during implementation; they are not treated as production-ready.
