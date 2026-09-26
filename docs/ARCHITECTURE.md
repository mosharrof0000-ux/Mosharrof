# Mosharrof Architecture

Mosharrof is a modular AI ecosystem. Each meaningful component is an Entity with identity, brain adapter, memory, tools, permissions, policy, scope, communication and audit.

## Capability boundary
Actual capability = Brain x Permission x Policy x Scope x Identity.

DELETE and destructive operations are permanently blocked.

## First-read registries
- `config/project_manifest.json` — project identity and immutable safety rules.
- `config/entity_registry.json` — entities, responsibilities, brains and permissions.
- `policies/CORE_POLICY.md` — governing rules.
- `docs/ARCHITECTURE.md` — architecture and lifecycle.

Entity Registry and model adapters keep the architecture model-agnostic.

## Entity lifecycle
Create -> Register -> Assign brain/model -> Assign responsibility -> Assign permission/scope -> Attach tools -> Test -> Audit -> Activate.

## Change lifecycle
Create → Review → Approve → Store → Backup → Document → Activate. Changes are tested before activation.

## Tool and storage safety
Tools are subject to the permission boundary. DELETE/destructive operations remain permanently denied. Storage indexing/search is read-only; file organization is an explicit MOVE operation and never deletes files. Name collisions are left untouched.

## Research tool boundary
Al-Quran Research is a tool/project under Mosharrof. Its existing project remains independent until explicit integration.
