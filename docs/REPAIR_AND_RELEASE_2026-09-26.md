# Mosharrof Repair and Release — 2026-09-26

## Scope
Stabilize the new Mosharrof repository without modifying the existing Al-Quran Research project or Project Agent.

## Repairs
- Restored constructor-compatible integration coverage for Mosharrof Core.
- Added conservative context-aware voice text processing.
- Added smart punctuation without inventing words.
- Added explicit raw-audio/ASR boundary.
- Hardened dynamic tool source checks against imports, shell execution, dynamic code execution, and common file mutation APIs.
- Added regression tests for the above.
- Added a GitHub Pages static entry point and CI-gated deployment workflow.

## Safety
- DELETE and destructive operations remain blocked by the core policy.
- No existing Al-Quran Research files were changed.
- Raw audio is not silently treated as recognized speech.
- Voice correction returns original/corrected text for auditability.

## Release gate
Changes must pass the repository test suite before merge to main.
