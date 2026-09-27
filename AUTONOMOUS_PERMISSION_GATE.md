# Mosharrof Autonomous Permission Gate

## Purpose
Protect the production `main` branch while allowing autonomous development in isolated branches.

## Required flow
User request -> isolated branch -> code -> tests -> browser/visual QA -> PR -> required checks -> controlled merge -> Pages deploy -> live health check.

## Agent permissions
- Read repository contents: allowed
- Write/create files: allowed only on isolated agent branches
- Create branches: allowed
- Create/update pull requests: allowed
- Read checks/workflows: allowed
- Run/re-run Actions when explicitly needed: controlled
- Read repository secrets: prohibited
- Write repository secrets: prohibited
- Direct production/main push: prohibited
- Force push: prohibited
- Repository deletion: prohibited
- Branch deletion: prohibited for the autonomous agent
- Production Pages/deployment credentials: not exposed to the coding agent

## Promotion gate
A change may reach `main` only after automated tests and visual QA pass. A failed gate stops promotion.

## Rollback
The last verified production commit must remain identifiable so a failed deployment can be reverted by an authorized maintainer.

## API work
Gemini/API credentials are intentionally excluded from this phase. They will be added only after the permission gate is established.
