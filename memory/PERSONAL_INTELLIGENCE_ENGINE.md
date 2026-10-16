# MOSHARROF Personal Memory Engine

## Behavior

- Stores each successful chat turn in the browser's IndexedDB database; no application-defined total record cap.
- Organizes records into topic folders such as `projects/mosharrof-ai`, `projects/android-automation`, `research/quran`, `writing/creative`, `projects/voice-audio`, `profile/preferences`, `timeline/open-loops`, and `topics/general`.
- Uses tags, topic folders, text overlap, and recency to retrieve relevant records for the current request.
- Adds a compact current-chat summary to the request context; the Worker places saved memory and history before the current user message.
- Current instructions take precedence over old memories. Changed preferences are timestamped and earlier preference versions remain in the timeline as superseded.
- Provides local controls to pause/resume memory, inspect topic folders and recent entries, export JSON, and clear the local memory database.

## Limits and privacy

"No application-defined cap" is not literally infinite storage. IndexedDB is limited by the browser/device quota, and the system reports storage failures rather than promising unlimited physical space. Memory currently stays in this browser/device and does not sync to another device or server. Use the JSON export for backup.

Memory is context, not proof. It may be incomplete or outdated. The AI must not claim to know unspoken thoughts; predictions about likely next steps are tentative suggestions, not instructions or authorization. Obvious credential-like content is excluded from automatic storage. Users can pause memory or clear it at any time.

## Verification

Automated tests cover chronological growth, preference supersession, relevance ranking, secret filtering, topic folders, export, clear/pause behavior, and the rule that the current user message remains last in the model context. Live promotion requires the normal architecture, size, test, Pages, and Worker checks.
