# Mosharrof Autonomous Operating Directive

Main/Live is a protected output boundary.
Autonomous work must happen on an isolated branch.
Never delete files, repositories, branches, secrets, environments, or data.
Never force-push.
Never modify deployment/security policy or protected workflow files from the autonomous agent.
Every proposed change must pass the repository test suite and the existing verification gate before promotion.
Current requested capability: secure screenshot analysis. Browser code must never contain an API key; analysis must go through the server-side screenshot Worker.
Every scheduled cycle should inspect the project and act only when a concrete, testable improvement exists.