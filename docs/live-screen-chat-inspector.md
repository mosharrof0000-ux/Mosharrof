# MOSHARROF Live Screen & Chat Inspector

## What it does now

This first, production-safe stage runs a real Chromium browser at a mobile viewport against either the candidate Pages build or the published Pages URL. It checks page loading, the left/right navigation drawers, the composer expand/cancel path, inventories visible interactive controls, and sends one test prompt through the UI while intercepting the chat Worker with a mock response. The mock proves the UI request/response path without contacting Gemini or another provider. Screenshots and a JSON report are saved as a GitHub Actions artifact.

## Safety boundary

- Uses a synthetic chat prompt only with the chat Worker intercepted in the browser; no real provider API call is made.
- Never clicks delete/clear/reset/account/security actions.
- Uses a fresh browser context; it does not access your phone's personal browser storage.
- Does not capture or stream the user's physical Android screen.
- Does not change source code or deploy anything. It reports findings only.
- Live checks are read-only smoke tests. Candidate pull-request checks run against the checked-out `web/` folder.

## Run it

1. Open **Actions → MOSHARROF Full-System Interaction QA**.
2. Select **Run workflow** and choose `live` for safe live-site checks or `candidate` to inspect the current `main` checkout.
3. Open the completed run and download the `mosharrof-live-screen-inspector-<run id>` artifact.
4. Review `report.json` and the PNG screenshots.

Pull requests automatically run against the candidate site before merge. After this workflow is merged to the default branch, it also runs every six hours against the live site. Temporary dependency/network failures get bounded retries; if the whole runner cannot reach the network, the next scheduled run starts the stateless checks again.

## Roadmap and limitations

This is a foundation, not a claim that every feature is already automated. Full coverage should be added in reviewed increments: isolated chat-backend contract tests using a mock/test endpoint, each organ's declared UI actions, history CRUD tests in disposable storage, voice tests with mocked microphone/provider responses, and Android device automation. Destructive or externally visible operations must stay opt-in and use test data. Physical Android screen access requires a separate device-side bridge with explicit Android screen-capture/interaction permission; GitHub Actions alone cannot see the user's phone.
