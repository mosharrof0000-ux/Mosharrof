# MOSHARROF — CONTINUITY / HANDOFF CONTROL
Version: 2026-09-28
Status: FOUNDATION ESTABLISHED
Branch: handoff/mosharrof-continuity-2026-09-28
Base commit: 555f982ebe02311bce836b149a97c5eb2e885ae3

## PURPOSE
This file is the continuity marker for any AI/agent working on Mosharrof.
If one agent stops because of context/token limits, the next agent must start here.
Do not assume unfinished work is complete.

## SAFETY RULES
1. Do not directly experiment on main or the live deployment.
2. Work on an isolated branch first.
3. Do not delete repository/project/critical assets as part of normal implementation.
4. Do not claim a feature is live until deployment and live behavior are verified.
5. Every implementation step must leave a trace: commit + updated status in this file.
6. Preserve the existing two-side drawer system; improve routing/content rather than replacing the structure.
7. Existing working UI is the baseline; changes must be additive and testable.
8. Failed experiments remain identifiable and must not silently replace the known-good baseline.

## CURRENT BASELINE
Latest verified repository commit available at foundation setup:
- 555f982 — service-worker cache bust / network-first HTML / old SW cleanup.
Current V5 UI exists in web/index.html.
Current repository also contains core architecture including brain/model adapter, memory, persistence/storage, permissions/policy, voice engine, project mapping, event bus, and tool factory.

## CURRENT GAP MODEL
The UI is ahead of backend integration. Several visible V5 controls are presentation-level while real core components already exist.
Priority is integration, not a full UI rewrite.

## IMPLEMENTATION ORDER
P0 — Foundation
- Keep this handoff record current.
- Record branch, base commit, current phase, completed work, blockers, next exact action.

P1 — Real Chat
- Connect V5 composer to Mosharrof brain/model adapter.
- Replace dummy acknowledgement response with real model pipeline.
- Preserve current visual chat UI.

P2 — Memory / History
- Connect Chat History, Memory/Knowledge surfaces to existing memory/persistent-store architecture.
- Make state persist across reloads where intended.

P3 — Entity Integration
- Surface existing Core, Chat, Voice, Storage, Tool Factory and Quran Research capabilities through real routes.
- Avoid creating duplicate systems when a repository component already exists.

P4 — Library / Project
- Turn Library and Project entries into usable workspaces backed by existing storage/project architecture.

P5 — Voice
- Connect the V5 microphone control to the existing voice engine.
- Verify permissions/failure states without breaking chat.

P6 — Research Tools
- Separate Research Tools from Tool Factory.
- Make Tool Factory the build/manage surface.
- Make Research Tools the run/use surface.

P7 — Quran Research
- Bring Al-Quran Research into Mosharrof as a real tool/module.
- Preserve source provenance and existing research safeguards.

P8 — Verification / Promotion
- Run tests.
- Inspect workflow/job results.
- Review changed files.
- Verify live behavior.
- Only then prepare promotion to main.

## TWO-SIDE NAVIGATION CONTRACT
LEFT = Mosharrof core/navigation:
Home, Chat, Chat History, Memory/Knowledge, Library, Projects, Notes, Voice, Settings, Profile.

RIGHT = active work/research/modules:
Quran Research, Research Lab, Research Memory, Knowledge Library, Research Tools, Tool Factory, Voice Research, Project Files, New Entity/Module.

The exact labels may evolve, but the left/right responsibility must remain stable.

## AGENT HANDOFF PROTOCOL
Before stopping, the working agent MUST update this file with:
- CURRENT PHASE
- LAST COMPLETED ACTION
- LAST VERIFIED COMMIT
- FILES CHANGED
- TESTS RUN + RESULT
- LIVE VERIFICATION STATUS
- BLOCKERS
- EXACT NEXT ACTION
- DO NOT TOUCH list, if applicable

The next agent must read this file first, inspect the referenced commit/branch, then continue from EXACT NEXT ACTION.
Never restart the project from assumptions.

## CURRENT PHASE
FOUNDATION

## LAST COMPLETED ACTION
Created isolated continuity branch from commit 555f982.

## LAST VERIFIED COMMIT
555f982ebe02311bce836b149a97c5eb2e885ae3

## FILES CHANGED IN THIS FOUNDATION STEP
PROJECT_HANDOFF.md (this file)

## TESTS
Repository branch creation: SUCCESS.
Application/live deployment: NOT re-verified by this foundation step.

## LIVE VERIFICATION STATUS
Not claimed as verified here.

## BLOCKERS
None for foundation setup.

## EXACT NEXT ACTION
Inspect the current web/index.html and core integration points on this branch, then implement P1 (Real Chat) only after confirming the existing backend entrypoint and request contract. Keep the change isolated and document the result here.

## DO NOT TOUCH
- Do not replace the V5 visual system wholesale.
- Do not delete existing core modules.
- Do not claim deployment success without workflow evidence.
- Do not merge this branch automatically.

## CONTINUITY MARKER
MOSHARROF-HANDOFF-2026-09-28-P0