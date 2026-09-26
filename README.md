# Mosharrof

**Mosharrof Karim — Intelligent Entity and AI Brain Architecture**

Mosharrof is being built as an entity-first, model-agnostic AI ecosystem.

## First read
1. `config/project_manifest.json`
2. `config/entity_registry.json`
3. `policies/CORE_POLICY.md`
4. `docs/ARCHITECTURE.md`

## Capability boundary
**Actual Capability = AI Brain × Permission × Policy × Scope × Identity**

DELETE and destructive operations are permanently denied.

## Repository structure
- `config/` — machine-readable project and entity registry
- `docs/` — architecture and design records
- `policies/` — non-negotiable rules
- `src/core/` — core runtime
- `src/tools/` — tools
- `tests/` — automated verification
- `site/` — GitHub Pages interface

## First integration
Al-Quran Research remains independent until explicit integration.

## Verification
Run `pytest -q`.

## Web
GitHub Pages is deployed from `site/` by `.github/workflows/deploy-pages.yml`.
