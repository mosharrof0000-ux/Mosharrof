# Mosharrof Architecture

Mosharrof is a modular AI ecosystem. Each meaningful component is an Entity with identity, brain adapter, memory, tools, permissions, policy, scope, communication and audit.

## Capability boundary
Actual capability = Brain x Permission x Policy x Scope x Identity.

DELETE and destructive operations are permanently blocked.

## Registries
The project manifest and entity registry are first-read machine-readable maps. A new model/runtime should be able to understand the project structure from them before opening implementation files.

## Entity lifecycle
Create -> Register -> Assign brain/model -> Assign responsibility -> Assign permission/scope -> Attach tools -> Test -> Audit -> Activate.

## Model portability
Identity, memory, responsibility, permission and policy are independent from the model provider. Model adapters can therefore be replaced without changing the entity contract.

## Research tool boundary
Al-Quran Research is the first planned research tool/project under Mosharrof. Its existing project remains independent until explicit integration.
