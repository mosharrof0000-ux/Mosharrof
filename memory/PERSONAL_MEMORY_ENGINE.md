# MOSHARROF Personal Memory Engine

The Pages runtime loads `core/personal-memory-engine.js` as `web/memory-engine.js` during artifact preparation. It stores substantive current-chat user messages in browser IndexedDB, deduplicates identical messages, classifies them into topic folders, records timestamps/tags/confidence, and retrieves a small relevant subset for future chat requests.

## User controls

The visible 🧠 স্মৃতি panel allows the user to pause/resume capture, inspect topic folders, delete an individual memory, export JSON, or clear all memories. The default is enabled to honor the user's explicit request for ongoing personal memory; users can pause it at any time. Secret-like content is filtered before saving. Memory storage failure never blocks chat.

## Context policy

Retrieved memories are historical context, not ground truth. The current user message and latest explicit correction take priority. The Worker bounds memory context before provider calls. This is application-level personalization, not model-weight retraining.

## Storage limits

There is no application-defined maximum record count. IndexedDB is still subject to browser/device storage quotas, browser data clearing, and device loss. This is local to the browser/device and is not automatically synchronized to other devices or other users. "Unlimited" therefore means no fixed app-level count, not physically unlimited storage.

## Acceptance checks

- Topic folders and timestamps are stored with each memory.
- Relevant memories are retrieved by lexical overlap, topic match, confidence, and recency.
- Only a bounded excerpt is sent to the chat Worker.
- Current instructions override old memory.
- Pause, per-item deletion, export, and clear-all are available.
- The chat remains usable if IndexedDB is unavailable.
