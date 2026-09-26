# Mosharrof Visual Inspection Engine

Before promotion, Mosharrof can use a real Chromium browser to:

- open the candidate UI;
- open the current live URL;
- capture screenshots;
- inspect HTTP status and page structure;
- verify header, chat area, composer and drawer exist;
- detect prohibited message-card styling;
- preserve screenshots/report as workflow evidence.

The next layer can send these two screenshots to a connected vision model (Gemini or another approved provider) for visual comparison and an explicit PASS/FAIL decision.

The browser inspector never receives permission to write to main or deploy directly.
