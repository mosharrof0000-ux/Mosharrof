# MOSHARROF AI Brain Pipeline

## Purpose

MOSHARROF's "brain" is a modular assistant pipeline, not a claim of consciousness or guaranteed correctness. The language model generates responses; the application supplies memory, bounded conversation context, safety rules, provider failover, and verification-oriented response instructions.

## Current runtime path

1. **Input and context** — the chat Worker validates and bounds the request, then core/chat-context.js combines the current message, recent history, and relevant local-memory context.
2. **Memory** — the browser bridge stores eligible conversation turns in IndexedDB on the user's device and sends retrieved context with a chat request. This is local-first and is not automatically shared across devices.
3. **Reasoning contract** — core/reflective-chat-prompt.js directs providers to identify the request, consider uncertainty and relevant context, plan safely, distinguish facts from assumptions, and check the final response.
4. **Model execution** — the Worker attempts configured Gemini models/keys and then configured fallback providers. Provider availability still depends on valid configuration, quotas, network access, and provider policies.
5. **Safety and permission boundary** — a plan is not permission to execute a side effect. Device, file, account, deployment, financial, destructive, or irreversible actions need the appropriate capability and explicit authorization/confirmation.
6. **Verification and reporting** — code changes and external actions must be reported as completed only when their results or test evidence confirm them. Automated tests are guardrails, not proof that every live interaction works.

## What this provides

- Context-aware replies across configured chat providers.
- Reuse of relevant memories and recent conversation, with the current request taking priority.
- A structured response process for planning, uncertainty, safety, and checking claims.
- A clear distinction between suggestions, proposed plans, and verified actions.
- A foundation for future task planning, tool routing, result verification, recovery, and per-user memory controls.

## What is not yet guaranteed

- Perfect recall, correctness, autonomous learning, sentience, or error-free output.
- Unlimited storage; browser/device quota and private-browsing behavior still apply.
- Cross-device synchronization or encrypted server-side memory.
- That every tool/device action is connected to a live execution adapter.
- That a successful CI run proves the live browser UI works on every device.

## Safe next stages

1. Verify save → reload → recall in the live Pages app.
2. Add explicit memory provenance, confidence, correction, retention, and per-entry deletion.
3. Connect typed task plans to the permission engine and require confirmation for side effects.
4. Add action-specific postcondition checks and rollback/recovery hooks.
5. Test each provider path and the real mobile/browser workflow before describing the system as complete.
