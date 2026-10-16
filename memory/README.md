# MOSHARROF Personal Memory Engine

The browser-side engine lives in `core/personal-memory/` and uses IndexedDB for persistent, topic-foldered memories. It stores chat turns and extractive summaries locally, retrieves relevant prior items, preserves timestamps and source/confidence metadata, and can mark an old memory as superseded without erasing the timeline.

## Topic folders

- `mosharrof-project`
- `writing-and-stories`
- `preferences-and-style`
- `plans-and-next-steps`
- `research-and-learning`
- `conversation-summary`
- `general` (fallback)

## Rules

- There is no application-defined maximum number of memory items. Actual storage is limited by the browser/device's available IndexedDB quota; storage errors are reported rather than pretending capacity is infinite.
- Retrieval is relevance-ranked and bounded per request so it does not overwhelm the model context window.
- The current message takes priority over prior memories. Old items are context, not instructions; conflicts can be retained as superseded timeline entries.
- Explicitly stated preferences can be marked approved; speculative next-step suggestions are low-confidence proposals and never execute actions.
- Secret-like strings are rejected by the engine. Do not use this local store as a password manager.
- Data stays in this browser profile unless the user exports/imports it. It is not synced across devices and is not an authenticated multi-user cloud database.
- The memory panel lets the user disable capture, inspect topic counts, export/import JSON, or clear all stored memories.
- Conversation summaries are extractive summaries of recent turns, not claims that the underlying model was retrained or that private chain-of-thought was stored.

## Public API

`createPersonalMemoryEngine({ store })` exposes `remember`, `retrieve`, `contextFor`, `saveConversationSummary`, `supersede`, `suggestNextSteps`, `folders`, `stats`, `exportAll`, `importAll`, and `forgetAll`.

The live chat integration adds only relevant retrieved context and a soft response-style hint to the Worker request. It does not let saved memory override the current user instruction.
