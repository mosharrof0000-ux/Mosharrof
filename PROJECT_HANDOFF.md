# MOSHARROF — CONTINUITY / HANDOFF CONTROL
Version: 2026-09-28
Status: P1 CONTRACT VERIFIED; PROVIDER IDENTIFICATION REQUIRED
Branch: handoff/mosharrof-continuity-2026-09-28
Base commit: 555f982ebe02311bce836b149a97c5eb2e885ae3

## PURPOSE
This is the first file an AI/agent must read when continuing Mosharrof work.
Never assume unfinished work is complete.

## SAFETY RULES
1. No direct experiments on main/live.
2. Isolated branch first.
3. No deletion of repository/project/critical assets.
4. No live-success claim without deployment + live verification.
5. Every step leaves commit + updated handoff status.
6. Preserve the two-side drawer system.
7. Preserve the V5 visual baseline; integrate rather than wholesale replace.
8. Never fake an AI/model response when a real provider is not connected.

## IMPLEMENTATION ROADMAP
P0 Foundation — DONE
P1 Real Chat — IN PROGRESS
P2 Memory / History
P3 Entity Integration
P4 Library / Project
P5 Voice
P6 Research Tools / Tool Factory
P7 Quran Research
P8 Test + workflow verification + live verification + promotion

## TWO-SIDE NAVIGATION CONTRACT
LEFT = core/navigation: Home, Chat, Chat History, Memory/Knowledge, Library, Projects, Notes, Voice, Settings, Profile.
RIGHT = active work/research: Quran Research, Research Lab, Research Memory, Knowledge Library, Research Tools, Tool Factory, Voice Research, Project Files, New Entity/Module.

## CURRENT PHASE
P1 — REAL CHAT

## LAST COMPLETED ACTION
Inspected V5 UI and the backend/core chat path. Created docs/CHAT_INTEGRATION_CONTRACT.md documenting the verified integration contract and blocker.

## LAST VERIFIED COMMIT
a969f775830d0f941721ef4811ed151651e54c68

## FILES CHANGED
- PROJECT_HANDOFF.md
- docs/CHAT_INTEGRATION_CONTRACT.md

## VERIFIED FINDINGS
- V5 chat currently shows a local dummy acknowledgement.
- MosharrofCoreBrain has BrainAdapter and process_intent().
- BrainAdapter requires a BrainProvider for real generation.
- model_adapter.py has only abstract + DeterministicAdapter; no production remote transport.
- web_server.py /api/process_thought returns a hard-coded response and does not generate through the brain.

## TESTS
Repository branch creation: SUCCESS.
Contract inspection: SUCCESS.
Real model integration: NOT YET IMPLEMENTED.
Live deployment: NOT VERIFIED in this step.

## BLOCKER
The actual production model provider/gateway, request/response contract, and secret location must be identified before real chat can be wired safely.

## EXACT NEXT ACTION
Find the existing Mosharrof production model gateway/provider (including workflows, Worker/API configuration, environment secret names, or existing client code). Do not invent a provider. Once verified, implement the thin provider adapter and wire V5 chat.

## DO NOT TOUCH
- main/live
- existing core modules for deletion
- V5 UI wholesale replacement
- hard-coded API keys
- fake "AI" success responses

## CONTINUITY MARKER
MOSHARROF-P1-2026-09-28-A969
