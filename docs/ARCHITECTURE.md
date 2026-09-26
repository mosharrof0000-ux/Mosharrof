# Mosharrof Architecture

Mosharrof is a modular, entity-first, model-agnostic AI ecosystem. Each meaningful component is an Entity with identity, brain adapter, memory, tools, permissions, policy, scope, communication and audit.

## Capability boundary

**Actual Capability = Brain × Permission × Policy × Scope × Identity**

DELETE and destructive operations are permanently blocked. A powerful model does not bypass these boundaries.

## First-read registries

- `config/project_manifest.json` — project identity and immutable safety rules.
- `config/entity_registry.json` — entities, responsibilities, brains and permissions.
- `policies/CORE_POLICY.md` — governing rules.
- `docs/ARCHITECTURE.md` — architecture and lifecycle.

## Entity lifecycle

Create → Register → Assign brain/model → Assign responsibility → Assign permission/scope → Attach tools → Test → Audit → Activate.

## Change lifecycle

Create → Review → Approve → Store → Backup → Document → Activate.

Changes must be tested before activation. Existing Al-Quran Research remains independent until explicit integration.

## Tool safety

Tools are loaded only after a static safety check. Tool creation and execution are subject to the permission boundary. DELETE/destructive operations remain permanently denied.

## Storage safety

Indexing and search are read-only. File organization is an explicit MOVE operation and never performs deletion; name collisions are left untouched.

## Upgradeability

Model adapters are replaceable without changing Entity identity, memory, responsibility or policy. Future models can be attached through the same adapter boundary.
