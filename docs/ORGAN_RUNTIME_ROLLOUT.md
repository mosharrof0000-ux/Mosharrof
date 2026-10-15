# MOSHARROF Organ Runtime Rollout

## Contract

1. Every organ owns a top-level `organs/<organ-id>/` folder and manifest.
2. Organ state is namespaced by organ ID; there is no implicit shared memory.
3. Cross-organ calls must be declared in the source manifest and target a registered public API.
4. Each operation must report success or issue; the bounded audit log stores no secrets.
5. Persistent storage, network access, credentials, paid services, code changes, and deployment are separate capabilities. They are not granted by the runtime.
6. A user-approved change must pass tests, review, backup/recovery checks, and deployment health verification before Live promotion.

## Migration status

- **Foundation:** registry, declared links, per-organ memory, public handler registration, guarded calls, health counters, and bounded audit history.
- **Legacy UI entities:** home, chat, history, library, project, notes, settings, quran, research, ai, and branch currently load through `web/entities/bootstrap.js`. They are not all migrated into isolated organ implementations yet.
- **Live integration:** do not route existing UI traffic through the new runtime until a dedicated migration PR adds adapter contracts and passes UI, voice, Gemini, navigation, and deployment smoke tests.

## User smoke checks after migration

1. Open Chat and send a harmless test message; confirm chat remains functional.
2. Open another section (e.g. Notes); verify Chat's private organ memory is not visible there.
3. Trigger a deliberately invalid/unauthorized test call in the non-production test panel; expect a clear denied result and no change to Live data.
4. Open the organ health report; confirm success/issue counts change only for the organ that performed the operation.
5. Verify voice and Gemini still work before declaring the migration complete.
