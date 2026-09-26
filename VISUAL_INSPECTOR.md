# Mosharrof Visual Inspector

Every pull request is visually inspected in a real Chromium browser. The candidate UI and current Live UI are captured, compared by a vision-capable Gemini model, and stored as evidence. Clear critical visual regressions block promotion.

The inspector is read-only: it cannot write to main or deploy.
