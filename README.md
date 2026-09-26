# Mosharrof

**Mosharrof Karim — Intelligent Entity and AI Brain Architecture**

Mosharrof is being built as a modular AI ecosystem. The Core coordinates independent entities; each entity has an explicit identity, responsibility, brain/model adapter, memory, tools, permissions, policy, communication channel, state, and audit trail.

## Core rules
- Every meaningful component is an Entity with a clear responsibility.
- Model choice is replaceable; identity, memory, policy, and history persist.
- Permissions are capability boundaries, not suggestions.
- DELETE and destructive operations are permanently blocked at the core policy layer.
- Temporary permissions must be scoped to a task, audited, and revoked after completion.
- New entities are registered through machine-readable manifests rather than ad-hoc files.
- Changes are tested before activation.
- The existing Al-Quran Research project remains a separate project/tool until explicitly connected.

## Structure
- `docs/architecture/` — architecture, manifest, entity registry, lifecycle
- `src/core/` — coordination primitives
- `src/entities/` — future independent entities
- `src/policies/` — hard capability rules
- `src/tools/` — tools with explicit registration
- `tests/` — automated verification
- `web/` — lightweight browser interface

## Current status
Foundation v1: core brain, event bus, memory ledger, explicit no-delete policy, machine-readable project manifest, entity registry, tests, and GitHub Pages deployment workflow.
