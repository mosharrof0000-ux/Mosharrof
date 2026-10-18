# MOSHARROF Full App Interactive QA

## What this engine checks

This is a reusable Playwright-based mobile browser QA runner for the deployed
MOSHARROF AI website/PWA. It does not assume the app is only a chatbot.

- Page load and title, chat composer, send, voice, image attachment and message region.
- Main navigation and options drawers open, then close via Escape.
- Composer tools open/close.
- Inventory of visible buttons, inputs, text areas, selects, links and accessible labels.
- JavaScript exceptions, console errors, failed requests and HTTP errors.
- Mobile screenshots and a JSON report retained as a GitHub Actions artifact.
- Optional single live-chat probe, disabled by default.

## Run it

1. Open **Actions → MOSHARROF Full App Interactive QA → Run workflow**.
2. Keep the default HTTPS target for the MOSHARROF live PWA.
3. First run with **Send one explicit test message** unchecked. This is read-only.
4. Download the `mosharrof-full-app-qa-<run id>` artifact and inspect
   `report.json` plus the screenshots.
5. Only when a real response test is intended, check **Send one explicit test message**.
   It sends exactly one supplied test message to the selected live chat and can consume
   provider quota. The report records the result; no production code is changed.

## Safe operating boundary

The runner deliberately does not click every button indiscriminately. Controls
such as delete, clear-history, external links, permissions and device settings can
have side effects, so they are inventoried for a human/feature-specific test rather
than triggered blindly. New feature-specific tests should be added in small modules
with explicit preconditions, expected results, cleanup and screenshots.

## Android device coverage

A cloud browser cannot touch the owner's physical phone or grant Android permissions.
This runner verifies the deployed web/PWA experience. Native Android features must
also be tested in an Android emulator/instrumentation job and, for actual device
permission/overlay/accessibility behavior, on a connected or owner-operated device.
The QA report must distinguish those results; never label emulator/browser coverage
as physical-device verification.
