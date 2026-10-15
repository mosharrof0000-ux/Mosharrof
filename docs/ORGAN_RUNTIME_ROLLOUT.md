# MOSHARROF Organ Runtime Rollout

## Contract
1. Every organ owns `organs/<organ-id>/` and a manifest.
2. Memory is namespaced by organ ID; there is no implicit shared memory.
3. Cross-organ calls require a declared dependency and registered public API.
4. Success/issue reporting uses a bounded audit log with redacted error details.
5. Persistence, network, credentials, paid services, code changes, and deployment are separate capabilities; the runtime does not grant them.
6. Live promotion requires passing tests, review, recovery checks, and deployment health verification.

## Migration status
- **Runtime foundation:** validated registry, declared links, per-organ in-memory state, guarded calls, health counters, and bounded audit.
- **UI entity migration:** home, chat, history, library, project, notes, settings, quran, research, ai, and branch have dedicated organ modules and isolated health/memory namespaces.
- **Feature engines still pending:** chat orchestration, voice/TTS/STT, research/Qur'an logic, storage, provider routing, and project/branch engines need their own contracts and tests. UI wrappers do not prove those engines are isolated.
- **Live integration:** the current module bootstrap loads `web/runtime/organs.registry.json`; `web/index.html` remains unchanged.

## User smoke checks
1. Open MOSHARROF AI and wait for `window.MosharrofEntitySystem.ready === true`.
2. In the browser console run `window.MosharrofEntitySystem.organRuntime.health()`; verify each organ has a row.
3. Run `window.MosharrofEntitySystem.organRuntime.memory.set("chat", "smoke-check", {ok:true})`, then `window.MosharrofEntitySystem.organRuntime.memory.get("notes", "smoke-check")`; the second command must return `null`.
4. Run `window.MosharrofEntitySystem.organRuntime.reportIssue("chat", "manual smoke check")`; Chat should become `degraded` while Notes stays unchanged. Refresh resets this diagnostic.
5. Confirm chat, navigation, voice, and Gemini work before declaring feature-engine migration complete.
