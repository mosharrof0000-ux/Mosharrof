# Organ Runtime

This module provides per-organ in-memory state, capability-gated calls, health reporting, and a bounded audit trail.

## Security boundaries

- Each organ's memory is namespaced; values are JSON-cloned to prevent reference leakage.
- Cross-organ calls require a declared dependency edge and a registered public API.
- Payloads and stored values are size-limited; memory and audit records are bounded.
- Secret-like memory keys are rejected.
- The runtime intentionally has no persistence, network, credential, filesystem, or deployment capability. These must be separate reviewed adapters with explicit permissions.

## Current integration status

This runtime is a tested foundation, not yet the application-wide default. Existing UI entity modules remain legacy adapters until each is migrated and verified. Do not describe all MOSHARROF features as fully isolated until the migration catalog and Live smoke tests confirm it.
