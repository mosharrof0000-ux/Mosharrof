# Mosharrof Architecture

Mosharrof is an entity-first, model-agnostic ecosystem.

## Core layers

1. Project Manifest
2. Entity Registry
3. Brain/Model Adapter Layer
4. Memory and State
5. Permission and Policy
6. Tool Registry
7. Communication/Event Bus
8. Audit and Versioning

## Entity contract

Every meaningful component can be represented as an entity with:

- identity
- responsibility
- brain adapter
- memory/state
- permissions
- policy
- tools
- communication
- audit
- version

The entity contract is extensible; not every entity needs every runtime capability.

## Model portability

Entity identity, responsibility, memory, permissions and audit history remain independent from the selected AI model. A model adapter can therefore be replaced without rebuilding the entity.

## Safety

DELETE and destructive operations are permanently blocked. Non-destructive changes are subject to scope and policy checks.

## Project discovery

A new AI or engineer should read the manifest, entity registry and core policy first. These files provide the machine-readable entry point for understanding the project.
