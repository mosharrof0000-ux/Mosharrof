# Mosharrof Architecture

## Purpose

Mosharrof is a model-agnostic intelligent entity ecosystem. The Core coordinates independent entities; each entity has an explicit identity, brain, responsibility, permission, policy, memory, tools, communication and audit boundary.

## Rules

1. No entity may exceed its declared responsibility or permission scope.
2. DELETE and destructive operations are permanently denied.
3. Temporary permissions must be task-scoped, audited and automatically expire.
4. AI-generated output is not automatically treated as verified truth.
5. Model adapters allow future model changes without replacing entity identity or memory.
6. Every important component must have a predictable home in the repository.
7. Changes follow: create -> review -> test -> approve -> merge -> document.

## Repository map

- `src/core/` — core runtime contracts
- `entities/` — entity definitions
- `brains/` — brain/model adapter contracts
- `policies/` — permission and safety policy
- `tools/` — tool implementations
- `memory/` — memory contracts and storage definitions
- `audit/` — audit records/contracts
- `docs/` — manifests and architecture documentation
- `web/` — static project interface
- `tests/` — automated tests

## Important limitation

The repository currently provides deterministic Python foundation components. It does not yet contain a production AI model runtime. Model providers must be connected through the adapter layer before claiming live AI autonomy.
