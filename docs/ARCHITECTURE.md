# Mosharrof Architecture

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful component is represented as an Entity with a defined identity, brain adapter, memory, responsibility, permission, policy, scope, tools, communication boundary and audit trail.

## First-read order

1. `config/project_manifest.json`
2. `config/entity_registry.json`
3. `policies/CORE_POLICY.md`
4. `docs/ARCHITECTURE.md`

These files are the machine-readable and human-readable map of the project.

## Capability boundary

**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

A capable model does not bypass its assigned permission, policy or scope.

## Permanent safety rule

DELETE and destructive operations are permanently blocked at the runtime guard.

## Entity lifecycle

Create → Register → Assign identity → Assign brain/model adapter → Assign responsibility → Assign permission/scope → Attach tools → Test → Audit → Activate.

## Model strategy

The Core depends on a brain/model adapter boundary. A model can be replaced without replacing the Entity identity, memory, responsibility, audit history or policy.

## Communication

Entities communicate through explicit internal channels such as the EventBus. Cross-entity actions must remain within the receiving entity's declared scope.

## Research tool boundary

Al-Quran Research is the first planned research tool/project. Its existing repository remains independent until explicit integration is approved. No existing Al-Quran Research production files are modified by this foundation.

## Change lifecycle

Create → Review → Approve → Store → Backup → Document → Activate.

Every activation must be testable and auditable.
