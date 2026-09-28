# Entity Awareness / Chaitanya System

Mosharrof already had an experimental brain scanner, but it treated arbitrary
object attributes as proof of a brain and could inject labels without verifying
the entity registry. That is not a reliable health mechanism.

The canonical system is now the Entity Consciousness Monitor.

## What it does

For every registered entity it verifies:

- identity is present;
- a brain identity is declared;
- scope is declared;
- permission profile is declared;
- deletion remains blocked.

The monitor produces AWARE or DEGRADED status and identifies missing contracts.
It never fabricates a brain, grants permissions, changes scope, or claims human-like
sentience.

## Current state

The registered entities are structurally covered by the awareness monitor. The
model registry currently contains no provider, so runtime_provider_attached remains
false. This is intentional: structural awareness must not be confused with a live
model connection.

The monitor is covered by automated tests and is part of the project's verification
contract.
