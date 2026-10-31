# ChatGPT ↔ MOSHARROF Memory Continuity

## What this adds
MOSHARROF can import visible user/assistant messages from a ChatGPT data export into its existing local, topic-searchable memory. Imported messages keep conversation and message identifiers, timestamps, source provenance, and chronological links to the preceding imported message in the same conversation. Searching the memory panel searches across folders, not only the currently selected topic.

## First import
1. In ChatGPT, request a data export from the account's Data Controls / data export settings.
2. Download and unzip the export archive when it becomes available.
3. Find `conversations.json` and open MOSHARROF's right-side drawer.
4. Under **ChatGPT ↔ মোশাররফ স্মৃতি সংযোগ**, choose that JSON file.
5. Review the preview counts and sample messages. Nothing is imported at preview time.
6. Press **আমদানির অনুমতি দিন** and confirm the browser prompt to import into this device's local IndexedDB memory.
7. Use **সব বিষয়ের স্মৃতিতে খুঁজুন…** to search across the imported history and current local memories.

## Safety and limitations
- This is a user-authorized export import, not automatic scraping of the ChatGPT account or access to private chats from another app.
- The import parser reads visible user/assistant text parts only; it ignores system/developer/tool records and skips recognizable credential-like or selected sensitive-category text.
- The existing memory engine applies its own safety filter too, so the final number imported can be lower than the preview count.
- Re-importing the same export is deduplicated by message ID. New messages require selecting an updated export.
- Imported history stays in this browser/device unless the user explicitly exports or transfers it. No cloud synchronization is implied.
- Suggested response-style rules are a draft based on visible assistant responses. They are stored for review and are not automatically activated.
- A browser export cannot reveal hidden reasoning, internal model instructions, or messages not present in the export.

## Validation boundary
Unit tests validate parsing, source provenance, chronological links, deduplication behavior, and draft-only style suggestions. Browser smoke tests validate the existing local memory round-trip. A passing candidate Pages build is not the same as a successful main deployment or a verified Android real-chat test.
