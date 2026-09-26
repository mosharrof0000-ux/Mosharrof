# Mosharrof Architecture

Mosharrof is a modular AI ecosystem. Each meaningful component is an Entity with identity, brain adapter, memory, tools, permissions, policy, scope, communication and audit.

## Capability boundary
Actual capability = Brain x Permission x Policy x Scope x Identity.

DELETE and destructive operations are permanently blocked.

## Registries
PROJECT_MANIFEST.json is the first-read project map. Entity Registry and model adapters keep the architecture model-agnostic.

## Entity lifecycle
Create -> Register -> Assign brain/model -> Assign responsibility -> Assign permission/scope -> Attach tools -> Test -> Audit -> Activate.

## Research tool boundary
Al-Quran Research is a tool/project under Mosharrof. Its existing project remains independent until explicit integration.
