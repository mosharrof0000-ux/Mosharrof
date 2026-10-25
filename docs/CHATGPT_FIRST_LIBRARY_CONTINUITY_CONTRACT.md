# ChatGPT-First Library and Continuity Contract

## User's goal
The user considers ChatGPT the current reference model for Mosharrof. Their authorized letters, instructions, plans, decisions, examples, and project progress should be organized so ChatGPT can retrieve relevant material when available, and Mosharrof can adopt the user's approved visible work style.

## Important reality
- A new ChatGPT conversation does not automatically read every document, prior chat, or external repository file.
- ChatGPT can use content present in the current conversation, enabled memory/context, user-provided uploads, or connected tools when available and authorized.
- Do not claim that every ChatGPT conversation is automatically copied to Mosharrof. Use a user-selected ChatGPT data export or another supported, explicit integration.
- Do not collect hidden reasoning, system/developer messages, private account data, or content that the user has not authorized for import.
- The user's visible examples may inform an editable style guide. Do not claim to copy ChatGPT model weights or hidden internal cognition.

## Required library behavior
1. **Single searchable catalog:** keep user-approved letters, instructions, decisions, project notes, tests, release evidence, and style examples in a canonical indexed library.
2. **Provenance:** every record includes source, import time, original conversation/document ID where available, and user-confirmed status.
3. **Read before acting:** when a task refers to previous work, a named plan, or a library item, search the catalog first and read the relevant source before proposing changes.
4. **Short working brief:** after retrieval, assemble a compact brief with current goal, latest known state, decisions, pending tasks, safety constraints, and evidence links.
5. **No guessing:** if the source is missing, stale, or inaccessible, say so. Do not invent that a document was read.
6. **User controls:** preview, import, search, export, correct, exclude, and delete supported records. Sensitive content should be excluded by default or require explicit selection.
7. **Style profile:** keep an editable, versioned style guide covering Bengali-first language preference, concise restatement, step-by-step problem solving, evidence-linked status, useful tables/icons, and explicit separation between proposed, implemented, tested, and deployed work.
8. **Mosharrof continuity:** use the same approved records to restore work state after a new session or app restart. Do not rely on model-weight training.
9. **Cross-session ChatGPT use:** when connected tools/files are available, retrieve only the relevant library sources. If no connector or uploaded file is available in a new chat, request/select the source instead of pretending it is already loaded.
10. **Verification:** test import, deduplication, search, provenance, export, and recovery after restart; separately verify Live Pages and Android.

## Operating rule
For a user request to continue existing work:
- retrieve the latest work ledger and related sources;
- identify the last proven checkpoint;
- do the next safe action on a feature branch;
- run tests and inspect failures;
- report evidence links and distinguish verified results from remaining work.

## Acceptance criteria
- A new session can recover the latest approved work ledger by searching the library.
- Relevant documents are retrieved rather than assuming the entire archive was read.
- Imported ChatGPT exports remain traceable and deduplicated.
- The style guide is editable and based only on visible, authorized examples.
- No automatic copy to Live/main until tests, review, and explicit deployment workflow pass.
