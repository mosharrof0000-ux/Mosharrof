# Mosharrof

**Mosharrof Karim — Intelligent Entity and AI Brain Architecture**

Mosharrof is a modular, model-agnostic AI ecosystem.

## Core rules

- Every meaningful component is an Entity with a defined responsibility.
- Each Entity has explicit identity, brain/model boundary, memory, tools, permissions, policy, communication, audit and version.
- Effective authority is bounded by: **AI Brain × Permission × Policy × Scope × Identity**.
- **DELETE and destructive operations are permanently blocked.**
- The Core coordinates Entities; it must not bypass their permissions.
- A model adapter may change without replacing Entity identity, memory, responsibility or history.
- Machine-readable manifests and registries provide one-glance project understanding.

## Project map

- `project.manifest.json` — project contract
- `registry/entities.json` — Entity registry
- `registry/policies.json` — permission and policy registry
- `src/core/` — Core runtime components
- `tests/` — automated tests

## Development rule

Build in an isolated branch, test, review, then promote to `main`. Do not use deletion as a cleanup mechanism.
