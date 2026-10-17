# MOSHARROF Smart Visual Intelligence Engine (SVIE)

SVIE centralizes semantic color decisions for the web/PWA UI. It is rules-first and conservative: it does not recolor the application wholesale.

## Core rules

- Red (#DC2626): real errors/failures, stop-requested states, and the small recording indicator.
- Blue (#2563EB): explicit selection and active controls only.
- Green (#16A34A): verified success, ready/connected states, and successful playback/download controls.
- Yellow (#EAB308): pending requests, timers, checking, and waiting.
- Neutral is the default for decorative icons and controls without a reliable semantic state.
- Soft tint is opt-in; high-severity error tint is limited to status/surface elements.
- Badges/pills are only requested for semantic status components, never applied to every control.
- Existing components are enhanced only for known status-bearing selectors; unrelated buttons and icons are untouched.

## API

The browser exposes `window.MosharrofVisualIntelligence` with:

- `resolve({component, state, severity, theme, tint, badge})`: deterministic style decision.
- `apply(element, options)`: styles only elements carrying `data-visual-intelligence`.
- `enhanceKnownStatusControls(root)`: derives state from existing status classes on timers and voice controls.
- `audit(root)`: checks opted-in controls for inconsistent tone use.

The Pages preparation step copies the source engine and stylesheet into the deployed artifact and injects their references into the generated HTML. The tracked legacy shell remains unchanged.

## Verification

Run `python -m pytest -q tests/test_design_intelligence_engine.py` and `node --test tests/architecture/ui-organ-bootstrap.test.mjs`. The Pages deployment workflow also runs the repository-wide test suite, size budget, and Chromium runtime health check before deployment.
