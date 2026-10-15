#!/usr/bin/env python3
"""Permission-safe browser inspection for MOSHARROF AI.

Inventories visible controls, exercises safe navigation/composer flows, and sends
one synthetic chat prompt only through a browser-intercepted mock Worker response.
It does not contact a real provider, delete history, or change account settings.
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
        async def mock_chat(route):
            if route.request.method == "OPTIONS":
                await route.fulfill(status=204, headers={
                    "access-control-allow-origin": "*",
                    "access-control-allow-methods": "POST, OPTIONS",
                    "access-control-allow-headers": "content-type",
                })
            else:
                await route.fulfill(status=200, content_type="application/json", headers={
                    "access-control-allow-origin": "*",
                }, body=json.dumps({
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

        # Activate each declared organ module in the disposable browser context.
        # This verifies event wiring/registry availability without changing remote data.
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

        # Return the shell to its neutral state before testing the composer/chat.
        await page.evaluate("""() => {
          for (const selector of ['#drawerLeft', '#drawerRight']) {
            const el = document.querySelector(selector);
            if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
          }
          document.querySelector('#scrim')?.classList.remove('open');
        }""")
        await page.wait_for_timeout(150)

        # Composer expansion is safe: only a temporary draft in this browser context.
        # Assert draft copy, cancel preservation, and explicit apply; never submit this draft.
        try:
            input_box = page.locator("#input")
            original_draft = "MOSHARROF inspector temporary draft"
            await input_box.fill(original_draft)
            expand = page.locator("#composerExpandBtn")
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
            await chat_input.fill("MOSHARROF inspector safe chat test")
            await page.locator("#sendBtn").click()
            mock_answer = page.locator("#messages .message.ai").filter(
                has_text="MOSHARROF inspector mock response: chat pipeline passed"
            )
            await mock_answer.wait_for(state="visible", timeout=12000)
            record("mocked_chat_round_trip", True,
                   "UI sent test prompt and rendered mocked Worker reply; provider was not called")
        except Exception as exc:
            record("mocked_chat_round_trip", False, repr(exc))

        # Enumerate remaining visible controls without clicking potentially destructive actions.
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
