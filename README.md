# Mosharrof

Mosharrof Karim — Intelligent Entity and AI Brain Architecture.

## Foundation

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful component can have its own identity, brain adapter, memory, responsibility, tools, permissions, policy, communication and audit boundary.

**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

### Permanent safety rule

DELETE and destructive operations are permanently blocked and cannot be granted temporarily.

### First-read architecture files

- `config/project_manifest.json`
- `config/entity_registry.json`
- `policies/CORE_POLICY.md`
- `docs/ARCHITECTURE.md`
- `docs/AI_ONBOARDING.md`

### Entity layout

Each entity has its own folder and separate boundaries for:

- `ENTITY.json`
- `memory/`
- `tools/`
- `audit/`

Current foundation entities:

- Core
- Chat
- Sidebar
- Al-Quran Research (external project boundary)

### Brain and model boundary

Entity identity, memory, permissions and audit history are independent of the model provider. The Core uses a brain-adapter boundary so a future model can be introduced without rebuilding the entity architecture.

### Testing

The repository test suite validates core orchestration, storage/voice integration, intent routing, scope boundaries, permanent DELETE blocking, temporary permission rules, audit recording and machine-readable configuration.

### First research tool

Al-Quran Research remains an independent project until explicit integration. This repository must not silently modify that project.

## Live site

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml` and is gated by the test suite.
