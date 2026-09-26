# Mosharrof

Mosharrof Karim — Intelligent Entity and AI Brain Architecture.

## Foundation

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful component has a machine-readable identity, brain assignment, responsibility, memory boundary, tools, permission profile, policy, scope and audit boundary.

**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

### Permanent safety rules

- DELETE is permanently blocked.
- Destructive operations are permanently blocked.
- Scope escape is blocked.
- Activation without tests is blocked.

### First-read architecture

1. `config/project_manifest.json`
2. `config/entity_registry.json`
3. `config/model_registry.json`
4. `config/policy.json`
5. `config/permission_profiles.json`
6. `policies/CORE_POLICY.md`
7. `docs/ARCHITECTURE.md`

### Entity structure

Every meaningful component is represented under `entities/<entity-id>/` where appropriate. The registry is the authoritative machine-readable map for identity, responsibility, brain, scope and permission boundaries.

### Model independence

`src/core/brain_adapter.py` separates entity identity from the underlying model/provider. A model can be replaced without changing the entity's identity, responsibility, memory, permission, scope or audit history.

### Voice processing

The voice entity supports conservative smart punctuation and explicit transcript-correction adapters. Audio-to-text remains model/provider agnostic; the foundation never fabricates an audio transcript.

## First research tool

Al-Quran Research remains an independent project until explicit integration.

## Live site

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml`.
