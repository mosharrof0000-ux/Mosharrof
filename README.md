# Mosharrof

Mosharrof Karim — Intelligent Entity and AI Brain Architecture.

## Foundation

Mosharrof is an entity-first, model-agnostic AI ecosystem. Each meaningful component can have its own identity, brain adapter, memory, responsibility, tools, permissions, policy, communication and audit boundary.

**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

### Permanent safety rule

DELETE and destructive operations are permanently blocked.

### First-read architecture files

1. `config/project_manifest.json`
2. `config/entity_registry.json`
3. `config/model_registry.json`
4. `config/policy.json`
5. `config/permission_profiles.json`
6. `policies/CORE_POLICY.md`
7. `docs/ARCHITECTURE.md`

### Entity structure

Each entity is kept in its own directory under `entities/<entity-id>/`. Its machine-readable contract defines its responsibility, brain, scope, permissions, memory, tools and audit boundary.

### Model independence

The brain adapter allows the underlying model/provider to change without changing the entity's identity, responsibility, memory, permissions, scope or audit history.

### First research tool

Al-Quran Research remains an independent project until explicit integration.

## Live site

GitHub Pages deployment is handled by `.github/workflows/deploy-pages.yml`.
