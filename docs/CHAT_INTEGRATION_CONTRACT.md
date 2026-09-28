# Mosharrof Chat Integration Contract — P1

Status: INVESTIGATION COMPLETE / IMPLEMENTATION BLOCKED ON REAL PROVIDER CONTRACT
Date: 2026-09-28
Branch: handoff/mosharrof-continuity-2026-09-28

## Verified facts
1. web/index.html contains the V5 chat UI, but its current response is a local dummy acknowledgement.
2. src/core/mosharrof_brain.py exposes process_intent() and owns a BrainAdapter.
3. src/core/brain_adapter.py requires an attached BrainProvider before generate() can work.
4. src/core/model_adapter.py only contains the abstract ModelAdapter and a DeterministicAdapter; it is not a production remote-model transport.
5. src/web_server.py has /api/process_thought, but it returns a hard-coded response and does not call MosharrofCoreBrain for generation.
6. Therefore replacing the V5 dummy response with a claimed "real AI" call now would be false unless the actual production provider/API endpoint and authentication contract are identified.

## P1 exact next implementation
A) Identify the production model gateway/provider already intended for Mosharrof.
B) Confirm request/response JSON contract and secret name/location.
C) Add a thin provider adapter; keep MosharrofCoreBrain as the coordinator.
D) Route the V5 composer to that API.
E) Add error/timeout/offline fallback without fabricating an AI answer.
F) Test locally/CI, then verify deployed behavior before promotion.

## Do not do
- Do not hard-code API keys.
- Do not replace the V5 UI wholesale.
- Do not make the deterministic adapter look like a real model.
- Do not merge to main until tests and deployment are verified.

## Handoff marker
MOSHARROF-P1-CONTRACT-2026-09-28
