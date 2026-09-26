# Mosharrof Core Policy

## Capability boundary
Actual capability is bounded by:

AI Brain × Permission × Policy × Scope × Identity

A model never grants itself permission.

## Permanent safety rules
1. DELETE operations are always denied.
2. Destructive operations are always denied.
3. No entity may act outside its declared scope.
4. Every privileged action must be attributable to an entity.
5. New tools must pass policy validation before activation.
6. Memory and audit records must remain traceable.
7. Model changes must not silently replace entity identity, memory, responsibility or policy.

## Change lifecycle
Create → Review → Test → Approve → Activate → Audit → Version

## Entity rule
Every meaningful component may be represented as an independent entity with its own identity, brain adapter, memory, responsibility, permissions, policy, tools, communication channel and audit boundary.
