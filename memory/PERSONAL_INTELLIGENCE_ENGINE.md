# Personal Intelligence & Memory Engine

## Implemented foundation

- Append-only personal memory ledger with no artificial total-entry count cap.
- Categories for preferences, goals, projects, corrections, decisions, facts, open questions, plans, hypotheses, events and commitments.
- Timestamped revisions, supersedes links, valid_from / valid_until fields, status tracking and next-step notes.
- Search/relevance ranking, chronological timeline, export/import, and a context builder that separates saved facts from hypotheses and asks the model to consider past, current goals, future plans and uncertainty.
- Candidate extraction only suggests a memory; it does not persist it automatically.
- Secret-like strings are rejected from direct memory writes and filtered from candidate suggestions.
- The Worker accepts a client-supplied personal_memory snapshot and adds relevant entries to the prompt. Candidate suggestions are returned only when memory_suggestions_enabled: true.

## Important limits / next integration work

Unlimited means no artificial record-count cap in the code. Browser localStorage and request payloads have finite device/browser quotas; one large JSON ledger can hit those quotas. For long-term production use, migrate the storage adapter to IndexedDB or authenticated per-user durable storage with export/restore and quota/error handling.

The Worker does not persist personal memories server-side, does not automatically know the user's full past across devices, and does not read private thoughts. The client must retain the user's ledger, send the relevant snapshot with chat requests, show memory suggestions for review, and provide inspect/export/delete controls. Until that client integration is verified, do not claim continuous background learning or cross-device memory is live.

## Privacy contract

- Keep user memories isolated by user/account namespace.
- Ask permission before saving inferred candidates; explicit user-approved memory may be stored directly.
- Keep hypotheses distinct from user-stated facts; old versions remain in the timeline as superseded rather than silently erased.
- Do not store credentials, OTPs, payment details, or sensitive inferred traits.
- Memory informs response planning only. Predictions remain suggestions, never authorization for consequential actions.