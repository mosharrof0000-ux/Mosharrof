# Mosharrof Core Architecture

## Identity
Every meaningful component is an Entity with an explicit identity and responsibility.

## Brain
Each Entity has a Brain interface. A model adapter may be replaced without changing the Entity identity, memory, policy, or history.

## Capability boundary
Actual capability is:

AI Brain × Permission × Policy × Scope × Identity

A powerful model never bypasses a permission boundary.

## Permanent safety rule
DELETE and destructive operations are denied by the central permission guard.

## Organization
- `PROJECT_MANIFEST.json`: one-glance project identity and rules.
- `registry/`: machine-readable entity registry.
- `policy/`: permission and safety rules.
- `src/core/`: stable core primitives.
- `src/entities/`: future independent entities.
- `src/tools/`: tools owned by the ecosystem.
- `tests/`: automated verification.
- `docs/`: human-readable architecture and operating rules.

## Lifecycle
Create → Review → Approve → Store → Backup → Document → Test → Activate.

## First external research tool
Al-Quran Research remains a separate project. It will be connected later as Mosharrof's first research/tool entity; it is not rebuilt inside this repository.
