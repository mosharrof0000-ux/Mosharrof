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

### Context-aware smart voice\n\n`src/core/voice_engine.py` provides authorization-aware voice journaling, smart punctuation, conservative high-confidence contextual correction, and a provider-neutral speech-to-text boundary.\n\n### Model independence

`src/core/brain_adapter.py` separates entity identity from the underlying model/provider. A model can be replaced without changing the entity's identity, responsibility, memory, permission, scope or audit history.

### First research tool

Al-Quran Research remains an independent project until explicit integration.

## Live site

GitHub Pages deployment is test-gated by `.github/workflows/test-and-pages.yml` and publishes the `site/` directory.\n\nLive site: https://mosharrof0000-ux.github.io/Mosharrof/
