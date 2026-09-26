# Mosharrof Project Map

The repository is organized so a new model or agent can understand the project from the manifest first, then the entity registry and architecture rules.

- PROJECT_MANIFEST.json — first-read project map
- docs/ENTITY_REGISTRY.json — entity inventory and contract
- src/core/ — core runtime contracts
- entities/ — entity-specific definitions
- brains/ — model/brain adapters
- policies/ — permission and policy rules
- tools/ — reusable tools
- memory/ — memory contracts
- audit/ — audit records and schemas
- app/ — live interface source
- tests/ — automated verification

Read order: PROJECT_MANIFEST.json → docs/ENTITY_REGISTRY.json → docs/ARCHITECTURE.md → relevant entity folder.
