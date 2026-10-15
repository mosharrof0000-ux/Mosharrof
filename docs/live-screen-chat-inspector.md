# MOSHARROF Live Screen & Chat Inspector

## What it does now

This first, production-safe stage runs a real Chromium browser at a mobile viewport against either the candidate Pages build or the published Pages URL. It checks page loading, the left/right navigation drawers, the composer expand/cancel path, and inventories visible interactive controls. Screenshots and a JSON report are saved as a GitHub Actions artifact.

## Safety boundary

- Never submits a chat message or deliberately calls Gemini/other provider APIs.
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

Pull requests automatically run against the candidate site before merge.

## Roadmap and limitations

This is a foundation, not a claim that every feature is already automated. Full coverage should be added in reviewed increments: isolated chat-backend contract tests using a mock/test endpoint, each organ's declared UI actions, history CRUD tests in disposable storage, voice tests with mocked microphone/provider responses, and Android device automation. Destructive or externally visible operations must stay opt-in and use test data. Physical Android screen access requires a separate device-side bridge with explicit Android screen-capture/interaction permission; GitHub Actions alone cannot see the user's phone.
