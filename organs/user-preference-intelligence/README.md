# User Preference Intelligence

Learns how the user prefers information to be presented and how features should behave, using explicit instructions and carefully qualified low-risk inferences.

## Safety contract

- It does not read minds and must not claim certainty about unstated wishes.
- The first implementation is in-memory only. It does not send data over a network or persist a profile across sessions.
- Only low-risk preference dimensions are in scope: presentation, voice, writing, research depth, and interaction.
- Sensitive traits and protected characteristics must not be inferred or stored.
- Explicit/corrected preferences outrank inferred preferences.
- A low-confidence inference is rejected; the user can correct or forget a preference.
- This organ has no dependency links and cannot edit, invoke, or reach other organs directly.
- Its public APIs are declared in `organ.json`; cross-organ use must be added later through a reviewed, declared contract.

## Current status

Foundation only. Durable storage, UI controls, cross-organ integration, and production activation are intentionally not claimed as implemented. Those require separate tests, permission design, and a reviewed migration plan.
