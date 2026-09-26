# Mosharrof Architecture

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful component is an Entity with identity, brain adapter, memory, tools, permissions, policy, scope, communication and audit.

## First-read order

1. config/project_manifest.json
2. config/entity_registry.json
3. policies/CORE_POLICY.md
4. docs/ARCHITECTURE.md

## Capability boundary

Actual Capability = AI Brain × Permission × Policy × Scope × Identity.

Model intelligence never bypasses the assigned permission, policy or scope.

## Permanent safety rule

DELETE and destructive operations are permanently blocked by the runtime permission guard.

## Entity lifecycle

Create → Register → Assign brain/model → Assign responsibility → Assign permission/scope → Attach tools → Test → Audit → Activate.

## Entity organization

Every registered entity has its own directory under entities/<entity-id>/, with dedicated areas for memory, tools and audit records.

## Model strategy

The Core uses a model-adapter boundary. A model can be replaced without replacing the Entity identity, responsibility, memory contract or audit history.

## Research tool boundary

Al-Quran Research is the first planned research tool/project. Its existing repository remains independent until explicit integration is approved. This foundation does not modify its production code.

## Change lifecycle

Create → Review → Approve → Store → Backup → Document → Activate.
