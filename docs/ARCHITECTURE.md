# Mosharrof Architecture

Mosharrof is an entity-first, model-agnostic AI ecosystem.

## Core layers
1. Project Manifest
2. Entity Registry
3. Brain/Model Adapter Layer
4. Memory and State
5. Permission and Policy
6. Tools
7. Communication
8. Audit and Versioning
9. UI

## Entity contract
Each entity is described independently so a new model or AI runtime can understand the project from the manifest and registry without reverse-engineering the whole repository.

## Model portability
Entity identity, memory, responsibility, permissions and policy are independent from the model provider. A model adapter can therefore be replaced without changing the entity contract.

## First integration
Al-Quran Research is kept as an independent project until an explicit integration step is approved.
