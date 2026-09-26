# Mosharrof Structure

The repository is entity-first and model-agnostic.

## First-read files

1. PROJECT_MANIFEST.json
2. core/entity_registry.json
3. core/brain_registry.json
4. core/permission_registry.json
5. policies/CORE_POLICY.md
6. docs/ARCHITECTURE.md

## Entity contract

Each entity is defined by identity, brain, memory, responsibility, permission, policy, tools, communication and audit requirements.

## Capability boundary

AI_BRAIN × PERMISSION × POLICY × SCOPE × IDENTITY

A capable model never receives authority outside its assigned permission and scope.

## Safety

DELETE and destructive operations are permanently blocked.

## Current entities

- core
- chat
- sidebar
- quran-research

Al-Quran Research remains an independent project until explicit integration.