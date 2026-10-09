# Universal Permission Engine v1

## Purpose
The capability registry is the central catalogue of current and future actions
that Mosharrof modules may request. It is intentionally broad so future video,
image, audio, file, document, AI, research, automation, storage, publishing,
learning and Quran-research modules do not need a new permission architecture.

## Important distinction
**Registered is not granted.** A catalogue entry is only a known capability.
The requesting entity must also have an explicit grant and pass policy, scope,
provider-readiness and user-approval checks. Unknown capabilities are denied.

## Implementation
- Catalogue: `config/capability_registry.json`
- Engine: `src/core/universal_permission_engine.py`
- Legacy low-level safety guard remains in `src/core/permission_guard.py`.
- Example: `UniversalPermissionEngine().authorize("video.create", entity_id="video-maker", granted_permissions=["video.create"], resource_scope="video/projects/demo", entity_scope="video/*", provider_ready=True, user_approved=True)`

## Security boundaries
- Delete/destructive-like operations remain permanently blocked, even if a
  grant pattern would otherwise match. Other high-impact actions require
  explicit user approval; they are not described as permanently blocked.
- Module registration does not activate a module.
- Missing provider configuration, missing user approval, unknown capability,
  failed policy or scope escape all deny the request.
- Audit decisions are currently held in memory for the lifetime of the engine.
  Production durable audit storage, UI for managing grants, and provider adapters
  require separate implementation and verification; this engine does not pretend
  those integrations already exist.

## Lifecycle
Register candidate capability -> request scoped grant -> verify policy/provider
and user approval -> authorize -> audit -> revoke temporary grant after task.
When the website matures, unused catalogue entries can be deprecated in a later
version without changing the authorization API.
