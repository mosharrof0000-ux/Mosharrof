# Mosharrof Core Policy

## Authority boundary

Actual capability is bounded by:

**AI Brain × Permission × Policy × Scope × Identity**

A capable model does not receive authority merely because it can generate an action.

## Permanent prohibitions

1. DELETE operations are denied.
2. Destructive operations are denied.
3. Secrets and credentials must never be written to source files, logs, tests, or responses.
4. An entity may act only inside its declared responsibility and scope.
5. New tools require explicit registration and audit metadata.
6. Production activation must follow test and review.

## Temporary permissions

Additional non-destructive permissions may be granted for a specific task, recorded in the audit trail, and revoked after completion.

## Entity isolation

Each entity has its own identity, brain adapter, memory/state, responsibility, permissions, policy, tools, communication channel and audit boundary as applicable.

## Change lifecycle

Create → Review → Test → Approve → Activate → Audit.

No entity may silently bypass this lifecycle.
