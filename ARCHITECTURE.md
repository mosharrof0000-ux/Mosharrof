# Mosharrof Core

Mosharrof is a modular AI ecosystem built around explicit Entities.

## Entity contract
Each Entity owns identity, brain adapter, responsibility, memory/state, permissions, policy, tools, communication, audit trail and version.

## Capability boundary
Actual capability is:
AI Brain x Permission x Policy x Scope x Identity

A capable model never bypasses the Entity permission or policy.

## Permanent safety rule
DELETE and destructive operations are denied by the runtime policy.

## Upgrade model
The model adapter can be replaced without replacing Entity identity, durable state, responsibility contract or audit history.

## Repository organization
- core: shared runtime contracts and registries
- entities: one folder per Entity
- tools: Tool definitions and integrations
- tests: executable verification
- site: public web interface

## First planned Tool
Al-Quran Research is treated as a Tool/Research Project integration. Its existing repository is not modified by this project.
