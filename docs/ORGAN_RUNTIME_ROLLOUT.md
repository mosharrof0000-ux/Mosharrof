# MOSHARROF Organ Runtime Rollout

## Contract
1. Every organ owns a top-level `organs/<organ-id>/` folder and manifest.
2. Organ state is namespaced by organ ID; there is no implicit shared memory.
3. Cross-organ calls require a declared dependency edge and registered public API.
4. Each operation reports success or issue; the bounded audit log avoids secret-bearing error messages.
5. Persistence, network access, credentials, paid services, code changes, and deployment are separate capabilities, not granted by the runtime.
6. A user-approved change must pass tests, review, backup/recovery checks, and deployment health verification before Live promotion.

## Migration status
- **Runtime foundation:** registry, declared links, per-organ in-memory state, guarded calls, health counters, and bounded audit history.
- **UI entity migration:** home, chat, history, library, project, notes, settings, quran, research, ai, and branch now have separate organ modules and runtime health/memory namespaces.
- **Underlying feature engines:** this migration moves UI entity adapters only. Chat orchestration, voice/TTS/STT, research/Qur'an logic, storage, provider routing, and project/branch operations still require their own implementation-specific organ contracts and tests before the whole app can be called fully organized.
- **Live integration:** runtime starts through the existing module bootstrap and loads `web/runtime/organs.registry.json`. The frozen `web/index.html` shell is unchanged.

## User smoke checks after deployment
1. Open MOSHARROF AI and wait for `window.MosharrofEntitySystem.ready` to become `true`.
2. In the browser console run `window.MosharrofEntitySystem.organRuntime.health()`; confirm each organ has its own row.
3. Run `window.MosharrofEntitySystem.organRuntime.memory.set("chat", "smoke-check", {ok:true})`, then `window.MosharrofEntitySystem.organRuntime.memory.get("notes", "smoke-check")`; the second command must return `null`.
4. Run `window.MosharrofEntitySystem.organRuntime.reportIssue("chat", "manual smoke check")`; Chat should become `degraded` while Notes remains unchanged. Refresh resets this in-memory diagnostic.
5. Confirm chat, navigation, voice, and Gemini remain functional before declaring feature-engine migration complete.
