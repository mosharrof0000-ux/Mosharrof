#!/usr/bin/env python3
"""Safe browser inspection with a mocked chat Worker; no real provider calls or destructive actions.
"""
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright

p = argparse.ArgumentParser()
p.add_argument("--url", required=True)
p.add_argument("--output-dir", default="artifacts/live-screen-inspector")
p.add_argument("--timeout-ms", type=int, default=45000)
args = p.parse_args()
out = Path(args.output_dir)
out.mkdir(parents=True, exist_ok=True)
report = {
    "agent": "MOSHARROF Live Screen & Chat Inspector",
    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    "target_url": args.url,
    "policy": {
        "chat_submission": "synthetic prompt submitted only against browser-intercepted mock Worker",
        "destructive_actions": "not performed",
        "provider_api_calls": "blocked by exact chat Worker route interception",
        "scope": "visible UI inventory and safe navigation smoke tests",
    },
    "checks": [],
    "controls": [],
    "errors": [],
}

def record(name, passed, detail=""):
    report["checks"].append({"name": name, "passed": bool(passed), "detail": str(detail)})
    if not passed:
        report["errors"].append({"check": name, "detail": str(detail)})

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 412, "height": 915},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
            permissions=[],
        )
        page = await context.new_page()
        page.set_default_timeout(min(args.timeout_ms, 10000))
        page.on("pageerror", lambda exc: report["errors"].append({"type": "pageerror", "detail": str(exc)}))
        page.on("console", lambda msg: report["errors"].append({"type": "console", "detail": msg.text})
                if msg.type == "error" else None)

        # Never send test prompts to a real provider. Intercept the chat Worker in-browser.
        mock_requests = []

        async def mock_chat(route):
            if route.request.method == "OPTIONS":
                await route.fulfill(status=204, headers={
                    "access-control-allow-origin": "*",
                    "access-control-allow-methods": "POST, OPTIONS",
                    "access-control-allow-headers": "content-type",
                })
            else:
                try:
                    mock_requests.append(json.loads(route.request.post_data or "{}"))
                except (json.JSONDecodeError, TypeError):
                    mock_requests.append({})
                await route.fulfill(status=200, content_type="application/json", headers={
                    "access-control-allow-origin": "*",
                }, body=json.dumps({
                    "ok": True,
                    "text": "MOSHARROF inspector mock response: chat pipeline passed",
                    "provider": "mock",
                    "model": "playwright-safe-test",
                    "attempted": [],
                }))
        await page.route("https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/chat", mock_chat)
        response = await page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
        await page.wait_for_timeout(1800)
        record("page_loaded", bool(response and response.status < 400),
               f"HTTP {response.status if response else 'no response'}")
        record("document_title", bool(await page.title()), await page.title())
        await page.screenshot(path=str(out / "initial-mobile.png"), full_page=True)

        for selector, name in [("#leftBtn", "left menu trigger"), ("#rightBtn", "right menu trigger"),
                               ("#input", "chat input"), ("#sendBtn", "send button")]:
            loc = page.locator(selector).first
            exists = await loc.count() > 0
            visible = exists and await loc.is_visible()
            record(f"control_{name.replace(' ', '_')}", visible, f"selector={selector}")
        
        # Exercise the two primary navigation drawers and record all visible menu controls.
        for trigger, drawer, label in [
            ("#leftBtn", "#drawerLeft", "left"),
            ("#rightBtn", "#drawerRight", "right"),
        ]:
            try:
                await page.locator(trigger).click(timeout=4000)
                await page.wait_for_timeout(350)
                drawer_loc = page.locator(drawer)
                # The shell opens drawers by class; aria-hidden is not consistently
                # synchronized by the primary handler, so measure the actual open state.
                is_open = await drawer_loc.evaluate("(el) => el.classList.contains('open')")
                aria_hidden = await drawer_loc.get_attribute("aria-hidden")
                record(f"{label}_drawer_opens", is_open,
                       f"selector={drawer}; aria-hidden={aria_hidden}")
                record(f"{label}_drawer_aria_state", aria_hidden == ("false" if is_open else "true"),
                       f"open={is_open}; aria-hidden={aria_hidden}")
                other_drawer = "#drawerRight" if label == "left" else "#drawerLeft"
                other_state = await page.locator(other_drawer).evaluate(
                    "(el) => ({open: el.classList.contains('open'), hidden: el.getAttribute('aria-hidden')})"
                )
                record(f"{label}_drawer_exclusive",
                       not other_state["open"] and other_state["hidden"] == "true",
                       f"other drawer state={other_state}")
                await page.screenshot(path=str(out / f"{label}-drawer.png"), full_page=True)
                if is_open:
                    controls = await drawer_loc.locator("button, a, input, select, textarea, [role=button]").evaluate_all(
                        """els => els.map((el, index) => {
                          const r = el.getBoundingClientRect();
                          return {
                            menu: %s, index, tag: el.tagName.toLowerCase(),
                            id: el.id || null, role: el.getAttribute('role'),
                            label: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim().slice(0, 140),
                            disabled: !!el.disabled, visible: !!(r.width && r.height),
                            width: Math.round(r.width), height: Math.round(r.height)
                          };
                        })""" % json.dumps(label)
                    )
                    report["controls"].extend(controls)
                    # Check touch-target sizes for enabled visible menu buttons; report, don't fail legacy UI.
                    targets = [c for c in controls if c["tag"] == "button" and c["visible"] and not c["disabled"]]
                    small = [c for c in targets if c["width"] < 40 or c["height"] < 40]
                    record(f"{label}_menu_controls_inventoried", True,
                           f"{len(controls)} controls; {len(small)} visible buttons below 40px")
                # Close through the drawer's own close control, then verify the state.
                close_button = drawer_loc.locator(".dclose, #cL, #cR").first
                if await close_button.count() and await close_button.is_visible():
                    await close_button.click(timeout=2500)
                else:
                    await page.evaluate("document.querySelector('#scrim')?.click()")
                await page.wait_for_timeout(250)
                if await drawer_loc.evaluate("(el) => el.classList.contains('open')"):
                    await page.evaluate("""selector => {
                      const drawer = document.querySelector(selector);
                      const scrim = document.querySelector('#scrim');
                      if (drawer) { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden','true'); }
                      if (scrim) scrim.classList.remove('open');
                    }""", drawer)
                    await page.wait_for_timeout(100)
            except Exception as exc:
                record(f"{label}_drawer_opens", False, repr(exc))

        # Exercise declared modules in this disposable browser context.
        try:
            await page.locator("#leftBtn").click(timeout=4000)
            modules = await page.locator("#drawerLeft [data-module]").evaluate_all(
                "els => els.map(el => ({module: el.getAttribute('data-module'), label: (el.innerText || '').trim()}))"
            )
            record("organ_module_controls_discovered", len(modules) > 0,
                   f"discovered {len(modules)} declared module controls")
            for item in modules:
                module = item["module"]
                try:
                    button = page.locator(f'#drawerLeft [data-module="{module}"]').first
                    if not await button.is_visible():
                        await page.locator("#leftBtn").click(timeout=3000)
                    await button.click(timeout=3000)
                    registered = await page.evaluate(
                        "id => !!window.MosharrofEntitySystem?.organRegistry?.has(id)",
                        {"core":"core","chat":"chat","sidebar":"sidebar","voice":"voice",
                         "storage":"storage","tool_factory":"tool-factory",
                         "quran_research":"quran-research"}.get(module, module)
                    )
                    record(f"organ_module_{module.replace('-', '_')}_activates",
                           registered, f"label={item['label']}; registry entry={registered}")
                except Exception as exc:
                    record(f"organ_module_{module.replace('-', '_')}_activates", False, repr(exc))
        except Exception as exc:
            record("organ_module_controls_discovered", False, repr(exc))

        # The organ menu remains open after module activation; dismiss it before
        # exercising history and settings so the scrim cannot intercept real clicks.
        await page.evaluate("""() => {
          for (const selector of ['#drawerLeft', '#drawerRight']) {
            const el = document.querySelector(selector);
            if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
          }
          document.querySelector('#scrim')?.classList.remove('open');
        }""")
        await page.wait_for_timeout(150)

        # History actions affect only this disposable browser context.
        try:
            await page.locator("#rightBtn").click(timeout=3000)
            await page.locator("#historyBtn").click(timeout=3000)
            history_open = await page.locator("#drawerLeft").evaluate("(el) => el.classList.contains('open')")
            record("history_button_opens_history_drawer", history_open)
            right_state = await page.locator("#drawerRight").evaluate(
                "(el) => ({open: el.classList.contains('open'), hidden: el.getAttribute('aria-hidden')})"
            )
            record("history_switch_closes_options_drawer",
                   not right_state["open"] and right_state["hidden"] == "true",
                   f"right drawer state={right_state}")
            search = page.locator("#historySearch")
            await search.fill("inspector-no-match-expected")
            no_match = await page.locator("#historyList").inner_text()
            record("history_search_updates_results",
                   "কোনো চ্যাট পাওয়া যায়নি" in no_match or "চ্যাট পাওয়া যায়নি" in no_match,
                   "search query filters the isolated history list")
            await search.fill("")
            await page.locator("#historyNewChat").click(timeout=3000)
            new_chat_visible = await page.locator("#messages").get_by_text(
                "নতুন কথোপকথন।", exact=True
            ).is_visible()
            record("history_new_chat_starts_session", new_chat_visible)
            await page.locator("#rightBtn").click(timeout=3000)
            await page.locator("#clearMsg").click(timeout=3000)
            cleared_visible = await page.locator("#messages").get_by_text(
                "মেসেজ মুছে ফেলা হয়েছে।", exact=True
            ).is_visible()
            record("clear_messages_action_works_in_isolated_context", cleared_visible)
            # Restore a clean temporary session before continuing tests.
            await page.locator("#rightBtn").click(timeout=3000)
            await page.locator("#newChat").click(timeout=3000)
        except Exception as exc:
            record("history_and_safe_local_actions", False, repr(exc))

        # Check audio settings without invoking microphone or providers.
        try:
            await page.locator("#rightBtn").click(timeout=3000)
            provider = page.locator("#ttsProviderSelect")
            voice = page.locator("#ttsVoiceSelect")
            language = page.locator("#sttLanguageSelect")
            provider_count = await provider.locator("option").count()
            voice_count = await voice.locator("option").count()
            language_count = await language.locator("option").count()
            record("audio_setting_options_present",
                   provider_count >= 6 and voice_count >= 2 and language_count >= 3,
                   f"TTS providers={provider_count}; voices={voice_count}; STT languages={language_count}")
            original_provider = await provider.input_value()
            await provider.select_option("browser")
            await provider.select_option(original_provider)
            original_voice = await voice.input_value()
            alternate_voice = "bn-BD-NabanitaNeural" if original_voice != "bn-BD-NabanitaNeural" else "bn-BD-PradeepNeural"
            await voice.select_option(alternate_voice)
            await voice.select_option(original_voice)
            original_language = await language.input_value()
            alternate_language = "en-US" if original_language != "en-US" else "bn-BD"
            await language.select_option(alternate_language)
            await language.select_option(original_language)
            record("audio_preferences_change_and_restore", True,
                   "provider, voice and STT language changed and restored; no audio/API call")
        except Exception as exc:
            record("audio_setting_options_present", False, repr(exc))

        # Return the shell to its neutral state before testing the composer/chat.
        await page.evaluate("""() => {
          for (const selector of ['#drawerLeft', '#drawerRight']) {
            const el = document.querySelector(selector);
            if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
          }
          document.querySelector('#scrim')?.classList.remove('open');
        }""")
        await page.wait_for_timeout(150)

        # Verify full-width input, eight-line cap, ninth-line expansion and provider long-press.
        try:
            input_box = page.locator("#input")
            expand = page.locator("#composerExpandBtn")
            server_count = await page.locator("#composerServerBtn").count()
            record("composer_server_pill_absent", server_count == 0, f"server button count={server_count}")
            dimensions = await page.locator("#composer .composer-input-row").evaluate(
                """row => {
                  const input = row.querySelector('#input');
                  const box = row.getBoundingClientRect();
                  const composer = document.querySelector('#composer').getBoundingClientRect();
                  const rect = input.getBoundingClientRect();
                  return {rowWidth: Math.round(box.width), composerWidth: Math.round(composer.width),
                          inputWidth: Math.round(rect.width), inputHeight: Math.round(rect.height),
                          widthRatio: rect.width / Math.max(1, composer.width)};
                }"""
            )
            record("composer_input_uses_full_width_and_readable_height",
                   dimensions["widthRatio"] >= 0.95 and dimensions["inputHeight"] >= 44,
                   json.dumps(dimensions, ensure_ascii=False))
            eight = "\n".join("inspection line " + str(i) for i in range(1, 9))
            await input_box.fill(eight)
            await page.wait_for_timeout(120)
            record("composer_expand_hidden_through_eight_lines", not await expand.is_visible())
            await input_box.fill(eight + "\ninspection line 9")
            await expand.wait_for(state="visible", timeout=4000)
            record("composer_expander_appears_on_ninth_line", await expand.is_visible())
            before_requests = len(mock_requests)
            send = page.locator("#sendBtn")
            await send.dispatch_event("pointerdown", {"button": 0, "pointerId": 1, "pointerType": "touch"})
            await page.wait_for_timeout(700)
            await send.dispatch_event("pointerup", {"button": 0, "pointerId": 1, "pointerType": "touch"})
            menu = page.locator(".manual-provider-menu")
            await menu.wait_for(state="visible", timeout=4000)
            choices = await menu.locator('[role="menuitemradio"]').count()
            record("composer_send_long_press_opens_provider_menu",
                   choices >= 5 and len(mock_requests) == before_requests,
                   f"choices={choices}; chat requests before={before_requests}; after={len(mock_requests)}")
            await menu.locator('[role="menuitemradio"]').first.click()
            record("composer_provider_menu_closes_after_selection",
                   await page.locator(".manual-provider-menu").count() == 0)
        except Exception as exc:
            record("composer_layout_and_provider_selection", False, repr(exc))

        # Composer expansion is safe: only a temporary draft in this browser context.
        # Assert draft copy, cancel preservation, and explicit apply; never submit this draft.
        try:
            input_box = page.locator("#input")
            original_draft = "\\n".join("MOSHARROF inspector draft line " + str(i) for i in range(1, 10))
            await input_box.fill("\\n".join("MOSHARROF inspector draft line " + str(i) for i in range(1, 9)))
            expand = page.locator("#composerExpandBtn")
            await page.wait_for_timeout(100)
            record("composer_expander_hidden_through_eight_lines", not await expand.is_visible(),
                   "expander remains hidden through eight lines")
            await input_box.fill(original_draft)
            await expand.wait_for(state="visible", timeout=8000)
            await expand.click()
            editor = page.locator("#mosharrofExpandEditor")
            await editor.wait_for(state="visible", timeout=5000)
            large_input = editor.locator("textarea")
            copied_text = await large_input.input_value()
            record("composer_expand_copies_draft", copied_text == original_draft,
                   f"expected {len(original_draft)} characters; received {len(copied_text)}")
            await page.screenshot(path=str(out / "composer-expanded.png"), full_page=True)
            await large_input.fill("MOSHARROF inspector cancelled edit")
            cancel = editor.locator("[data-expand-cancel]")
            await cancel.click()
            await page.wait_for_timeout(100)
            preserved = await input_box.input_value() == original_draft
            record("composer_expand_cancel_preserves_draft", preserved,
                   "cancel must close editor without applying edits")
            await expand.click()
            await editor.wait_for(state="visible", timeout=3000)
            await large_input.fill("MOSHARROF inspector applied edit")
            await editor.locator("[data-expand-apply]").click()
            applied = await input_box.input_value() == "MOSHARROF inspector applied edit"
            record("composer_expand_apply_updates_draft", applied,
                   "apply must copy edited text back into the composer; draft remains unsent")
        except Exception as exc:
            record("composer_expand_flow", False, repr(exc))

        # Exercise a complete chat round-trip against a mocked Worker response.
        # This verifies the UI request/response path without spending provider quota or
        # changing remote state. The route above prevents the real chat endpoint call.
        try:
            chat_input = page.locator("#input")
            await chat_input.fill("MOSHARROFMEMORYCHECK731")
            await page.locator("#sendBtn").click()
            mock_answer = page.locator("#messages .message.ai").filter(
                has_text="MOSHARROF inspector mock response: chat pipeline passed"
            )
            await mock_answer.wait_for(state="visible", timeout=12000)
            record("mocked_chat_round_trip", True,
                   "UI sent test prompt and rendered mocked Worker reply; provider was not called")
        except Exception as exc:
            record("mocked_chat_round_trip", False, repr(exc))

        # Verify memory save, reload persistence, and retrieval via mocked Worker.
        try:
            await page.wait_for_function(
                "() => !!window.MosharrofPersonalMemory && typeof window.MosharrofPersonalMemory.list === 'function'",
                timeout=8000,
            )
            await page.wait_for_function(
                """async () => {
                    const api = window.MosharrofPersonalMemory;
                    if (!api) return false;
                    const rows = await api.list(100);
                    return rows.some(row => row.kind === "user" && row.text.includes("MOSHARROFMEMORYCHECK731"))
                        && rows.some(row => row.kind === "assistant" && row.text.includes("MOSHARROF inspector mock response"));
                }""",
                timeout=10000,
            )
            rows_before_reload = await page.evaluate("async () => await window.MosharrofPersonalMemory.list(100)")
            record(
                "memory_bridge_saves_user_and_assistant_turns",
                any(row["kind"] == "user" and "MOSHARROFMEMORYCHECK731" in row["text"] for row in rows_before_reload)
                and any(row["kind"] == "assistant" and "MOSHARROF inspector mock response" in row["text"] for row in rows_before_reload),
                f"stored {len(rows_before_reload)} rows: " + json.dumps([{"kind": row.get("kind"), "text": row.get("text", "")[:100]} for row in rows_before_reload], ensure_ascii=False),
            )

            await page.reload(wait_until="domcontentloaded", timeout=args.timeout_ms)
            await page.wait_for_function(
                "() => !!window.MosharrofPersonalMemory && typeof window.MosharrofPersonalMemory.list === 'function'",
                timeout=10000,
            )
            await page.wait_for_function(
                """async () => {
                    const rows = await window.MosharrofPersonalMemory.list(100);
                    return rows.some(row => row.kind === "user" && row.text.includes("MOSHARROFMEMORYCHECK731"));
                }""",
                timeout=10000,
            )
            rows_after_reload = await page.evaluate("async () => await window.MosharrofPersonalMemory.list(100)")
            record(
                "memory_survives_page_reload",
                any(row["kind"] == "user" and "MOSHARROFMEMORYCHECK731" in row["text"] for row in rows_after_reload),
                f"reloaded browser found {len(rows_after_reload)} rows: " + json.dumps([{"kind": row.get("kind"), "text": row.get("text", "")[:100]} for row in rows_after_reload], ensure_ascii=False),
            )

            previous_answer_count = await page.locator("#messages .message.ai").count()
            await page.locator("#input").fill("Continue from memory: MOSHARROFMEMORYCHECK731")
            await page.locator("#sendBtn").click()
            await page.wait_for_function(
                "count => document.querySelectorAll('#messages .message.ai').length > count",
                arg=previous_answer_count,
                timeout=12000,
            )
            for _ in range(100):
                if len(mock_requests) >= 2:
                    break
                await page.wait_for_timeout(100)
            followup_request = mock_requests[-1] if len(mock_requests) >= 2 else {}
            memory_context = str(followup_request.get("memory_context") or "")
            record(
                "retrieved_memory_is_sent_to_chat_worker",
                "MOSHARROFMEMORYCHECK731" in memory_context,
                f"memory_context length={len(memory_context)}; mock requests={len(mock_requests)}; context={memory_context[:800]!r}",
            )
        except Exception as exc:
            record("memory_persistence_and_recall_round_trip", False, repr(exc))

        # Inventory remaining visible controls without destructive clicks.
        try:
            report["visible_controls"] = await page.locator("button, a, input, select, textarea, [role=button]").evaluate_all(
                """els => els.map((el, index) => {
                  const r = el.getBoundingClientRect();
                  return {index, tag:el.tagName.toLowerCase(), id:el.id||null,
                    label:(el.getAttribute('aria-label')||el.innerText||el.getAttribute('title')||'').trim().slice(0,140),
                    visible:!!(r.width&&r.height), disabled:!!el.disabled,
                    width:Math.round(r.width),height:Math.round(r.height)};
                }).filter(x => x.visible)"""
            )
        except Exception as exc:
            report["errors"].append({"type": "inventory", "detail": repr(exc)})
        await page.screenshot(path=str(out / "final-mobile.png"), full_page=True)
        await context.close()
        await browser.close()

    # Uncaught browser exceptions must fail QA; previously they were only logged,
    # allowing a green check despite runtime JavaScript errors.
    page_errors = [e for e in report["errors"] if e.get("type") == "pageerror"]
    record("browser_uncaught_exceptions_absent", len(page_errors) == 0,
           f"{len(page_errors)} uncaught browser exception(s)")

    report["summary"] = {
        "passed": sum(1 for c in report["checks"] if c["passed"]),
        "failed": sum(1 for c in report["checks"] if not c["passed"]),
        "control_count": len(report.get("visible_controls", [])),
        "menu_control_count": len(report["controls"]),
    }
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False))
    print("FAILED_CHECKS=" + json.dumps([c for c in report["checks"] if not c["passed"]], ensure_ascii=False))
    print("BROWSER_ERRORS=" + json.dumps(report["errors"], ensure_ascii=False))
    if report["summary"]["failed"]:
        raise SystemExit(1)

asyncio.run(main())
