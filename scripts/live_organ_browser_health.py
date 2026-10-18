#!/usr/bin/env python3
"""Verify the deployed/candidate Pages app serves and executes the organ runtime."""
from __future__ import annotations

import json
import os
import urllib.request
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright
from composer_expansion_browser_check import check_composer_expansion

BASE_URL = os.environ["PAGE_URL"].rstrip("/") + "/"
REQUIRED_ORGANS = {
    "core", "chat", "sidebar", "voice", "storage", "tool-factory", "quran-research"
}
ASSETS = (
    "entities/bootstrap.js",
    "entities/organ-bootstrap.js",
    "entities/ui-organ-modules.js",
    "runtime/core/organ-runtime/index.js",
    "runtime/core/organ-runtime/persistent-memory.js",
    "runtime/core/organ-runtime/scoped-api.js",
    "runtime/core/organ-runtime/persistent-memory.js",
    "runtime/core/organ-runtime/scoped-api.js",
    "runtime/core/ui-module-adapter/index.js",
    "organs/chat/index.js",
    "organs/core/index.js",
    "organs/voice/index.js",
    "organs/quran-research/index.js",
)


def read(path: str) -> bytes:
    with urllib.request.urlopen(urljoin(BASE_URL, path), timeout=30) as response:
        if response.status != 200:
            raise AssertionError(f"HTTP {response.status} for {path}")
        return response.read()


def main() -> int:
    html = read("")
    assert b"MOSHARROF AI" in html, "app title/entrypoint marker missing"
    registry = json.loads(read("runtime/organs.registry.json"))
    ids = {item["id"] for item in registry.get("organs", [])}
    assert REQUIRED_ORGANS.issubset(ids), f"missing visible organ IDs: {sorted(REQUIRED_ORGANS - ids)}"
    for asset in ASSETS:
        read(asset)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.on("pageerror", lambda error: print(f"BROWSER PAGE ERROR: {error}"))
        page.on("console", lambda message: print(f"BROWSER CONSOLE ERROR: {message.text}") if message.type == "error" else None)
        page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function(
            "() => window.MosharrofEntitySystem && window.MosharrofEntitySystem.ready === true",
            timeout=30000,
        )
        health = page.evaluate("window.MosharrofEntitySystem.organRuntime.health()")
        runtime_ids = {item["organId"] for item in health}
        assert REQUIRED_ORGANS.issubset(runtime_ids), (
            f"runtime health missing visible organs: {sorted(REQUIRED_ORGANS - runtime_ids)}"
        )
        mapping = {
            "core": "core",
            "chat": "chat",
            "sidebar": "sidebar",
            "voice": "voice",
            "storage": "storage",
            "tool_factory": "tool-factory",
            "quran_research": "quran-research",
        }
        for module_id, organ_id in mapping.items():
            control = page.locator(f'[data-module="{module_id}"]')
            assert control.count() > 0, f"visible module control missing: {module_id}"
            assert control.first.get_attribute("data-organ-id") == organ_id, (
                f"{module_id} did not connect to organ {organ_id}"
            )
        try:
            # The composer enhancer is dynamically imported by the sidebar bootstrap.
            # Wait for its button before exercising the line-limit state machine.
            page.wait_for_selector("#composerExpandBtn", state="attached", timeout=15000)
            check_composer_expansion(page)
        except Exception:
            diagnostic = page.evaluate("""() => {
                const input = document.querySelector("#input");
                const button = document.querySelector("#composerExpandBtn");
                return {
                    inputExists: !!input,
                    inputClass: input ? input.className : null,
                    inputValue: input ? input.value : null,
                    scrollHeight: input ? input.scrollHeight : null,
                    clientHeight: input ? input.clientHeight : null,
                    inlineHeight: input ? input.style.height : null,
                    inlineMaxHeight: input ? input.style.maxHeight : null,
                    buttonExists: !!button,
                    buttonClass: button ? button.className : null,
                    buttonDisplay: button ? getComputedStyle(button).display : null
                };
            }""")
            print("COMPOSER_EXPANSION_DIAGNOSTIC=" + json.dumps(diagnostic, ensure_ascii=False))
            raise
        browser.close()

    print("LIVE ORGAN RUNTIME BROWSER HEALTH CHECK: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
