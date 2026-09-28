# Mosharrof Component Awareness

Mosharrof's entity architecture already defines identity, brain, memory, tools, permissions, scope, communication and audit. This layer makes that contract runtime-verifiable.

`scripts/entity_awareness.py` checks every registered entity before autonomous work and writes `artifacts/entity-awareness.json`.

“চৈতন্য” here means **technical runtime awareness**, not a claim of sentience: every entity is machine-verified for identity, responsibility, brain label, permission/scope, communication relationship, audit location and heartbeat state.

If a contract or global safety invariant fails, the check exits non-zero and the autonomous pipeline stops before promotion.

Current registered entities include Core, Chat, Sidebar, UI, Voice, Storage, Tool Factory and Al-Quran Research.
