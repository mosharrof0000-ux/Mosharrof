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
3. `policies/CORE_POLICY.md`
4. `docs/ARCHITECTURE.md`

The root `PROJECT_MANIFEST.json` and `ENTITY_REGISTRY.json` are synchronized compatibility maps; the `config/` files are canonical.

### Entity structure

Every registered entity has an isolated `entities/<entity>/ENTITY.json` contract. Entity brain/model selection remains replaceable through the model-adapter boundary.

### First research tool

Al-Quran Research remains an independent project until explicit integration. Its Mosharrof entity is a scoped tool boundary only.

## Live site

GitHub Pages is deployed from `web/` by `.github/workflows/deploy-pages.yml`.

Expected live URL:
`https://mosharrof0000-ux.github.io/Mosharrof/`
