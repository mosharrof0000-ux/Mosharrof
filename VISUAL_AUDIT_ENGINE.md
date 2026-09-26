# Mosharrof Visual Audit Engine

Mosharrof can use a real Chromium browser to inspect its own UI.

The audit captures mobile and desktop screenshots, checks required interface elements, and can compare screenshots against a baseline. A scheduled run also opens the real GitHub Pages URL every six hours and stores screenshot evidence as an artifact.

This is a staging/verification layer. It does not grant the browser or visual auditor permission to modify main or production directly.
