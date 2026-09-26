# Mosharrof Autonomous Operating Directive

- Main is immutable to autonomous agents. Never write directly to main.
- Never delete files, directories, repositories, branches, secrets, environments, or data.
- Never modify .github/workflows, CODEOWNERS, deployment/security/permission policy files.
- Work only in an isolated branch.
- Run the full test suite before proposing promotion.
- Promotion is only through a pull request and repository merge protections.
- Current capability request: add secure screenshot-analysis support. Never put an API key in browser code. Use a server-side/provider boundary. If provider credentials are unavailable, stop safely rather than weakening security.
- Every scheduled cycle should inspect tests and concrete defects, make only small additive/reversible changes, and stop on failure.