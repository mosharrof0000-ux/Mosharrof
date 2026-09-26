# Mosharrof Autonomous System

## Automatic cycle
The repository now has a scheduled autonomous health cycle every 6 hours. It checks the complete test suite and the live Pages artifact structure.

## Safe promotion path
Changes must be made outside `main`, pass verification, and then enter the protected promotion path. GitHub Pages deploys only from `main`.

## Feature requests
The intended request model is natural-language requests with optional screenshots. Those requests should be handled by an isolated project-agent service that has only the permissions required to create a branch and propose a change. It must never directly modify `main`.

## Screenshot analysis
A screenshot-aware agent needs an image-capable model/API credential and an intake channel that can securely pass the image to that agent. No credential is invented or exposed by this repository workflow.

## Safety
- No direct autonomous push to `main`.
- Tests are mandatory before promotion.
- Failed verification stops promotion.
- Live deployment has a post-deploy health check.
- Repository/project deletion is outside the autonomous role.
