# MOSHARROF AI Personal Memory

The live chat memory feature is local-first and topic-indexed.

- Core engine: `core/personal-memory/memory-engine.js`
- Browser adapter and chat bridge: `web/personal-memory-bootstrap.js`
- Tests: `tests/test_personal_memory_engine.mjs` and `tests/test_chat_context_memory.mjs`
- Storage: browser IndexedDB, not a cloud account database.
- Organization: topic folders and year-month paths, with timestamps, roles, keywords, and conversation IDs.
- Retrieval: current conversation summary, topic/keyword-matched past messages, preference records, and tentative follow-up cues.
- Priority: current user request > current conversation > relevant dated memories. Old memories are context, not current instructions.
- Controls: in-app “স্মৃতি” panel shows folders, exports JSON, and can clear stored memory.
- Security: credential-like text is redacted before memory storage. Memory is not used to infer sensitive traits or claim to know the user's mind.

There is no application-level record-count cap. This is not literally infinite storage: browser/device quota, private browsing, user-cleared site data, and browser policies can limit or remove IndexedDB data. Memories are not synchronized across devices in this version. Do not claim cloud persistence or model-weight training.
