# Mosharrof Core Contract

## Purpose

Mosharrof is the root coordination system. Meaningful future components are
registered as separate entities with their own responsibility and brain
interface rather than becoming anonymous code inside the Core.

## Entity contract

Every entity declares:

1. stable identity
2. responsibility and scope
3. brain/model adapter
4. working and long-term memory
5. permission profile
6. tools
7. communication channel
8. audit trail
9. version/state

## Capability boundary

Actual capability is bounded by:

`AI Brain × Permission × Policy × Scope`

A stronger model never bypasses a weaker permission boundary.

## Permanent safety rule

DELETE and destructive operations are not available to the runtime policy.

Temporary permissions may be granted for a narrowly defined task only when they
are explicitly recorded, audited and automatically expire after the task.

## Model independence

Entity identity, memory, responsibility and policy must not depend on a specific
vendor model. A model adapter may be replaced without changing the entity
identity.

## Change lifecycle

Changes should be developed in an isolated branch, tested, reviewed and then
promoted. Production-facing activation is separate from implementation.
