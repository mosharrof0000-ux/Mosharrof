# Mosharrof Architecture

Mosharrof is a model-agnostic intelligent entity ecosystem. The Core coordinates independent entities; each entity has an explicit identity, brain, responsibility, permission, policy, memory, tools, communication, audit and version boundary.

## Capability boundary

Actual capability = AI Brain × Permission × Policy × Scope × Identity.

## Permanent rules

- DELETE operations are permanently denied.
- Destructive operations are permanently denied.
- Child entities receive only the permissions required for their responsibility.
- Temporary permissions must be task-scoped, audited and expire automatically.
- AI output is not automatically verified truth.
- Model adapters allow model replacement without replacing entity identity or memory.
- Every component has a predictable repository location.
- Changes follow Create → Review → Test → Approve → Merge → Document.

## Repository map

- docs/ — machine-readable project documentation
- registry/ — entity and brain registries
- policies/ — capability and safety policies
- src/core/ — runtime contracts
- src/entities/ — independent entity implementations
- src/brains/ — model adapter contracts
- src/tools/ — tool implementations
- memory/ — memory contracts
- audit/ — audit records
- web/ — live interface
- tests/ — automated verification

## Runtime note

This repository contains the deterministic foundation and interface. A production AI provider is connected only through the model-adapter boundary; no file claims an unavailable model runtime as active.
