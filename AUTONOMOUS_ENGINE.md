# Mosharrof Autonomous Engine

Task → isolated agent branch → tests → PR → verification → protected main → Pages deploy → live health check.

- Runs every 6 hours.
- Can also be manually triggered with a task.
- Requires repository secret \`GEMINI_API_KEY\`.
- Agent never pushes directly to main.
- Destructive operations are blocked.
- Promotion depends on main branch protection/rulesets.
- GitHub Pages deploys only from main.
