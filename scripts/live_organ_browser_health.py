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


def check_personal_memory_round_trip(page) -> None:
    """Type a chat message, persist it locally, reload, and verify recalled context.
    The chat Worker is mocked so this smoke test never spends API quota or changes
    production chat history on the server.
    """
    marker = "BLUE_RIVER_MEMORY_SMOKE_" + uuid.uuid4().hex[:10]
    first_message = f"Please remember this: the test phrase is {marker}."
    captured_requests: list[dict] = []

    def mock_chat(route) -> None:
        payload = json.loads(route.request.post_data or "{}")
        captured_requests.append(payload)
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True, "text": "Browser memory smoke test reply."}),
        )

    page.route("**/chat", mock_chat)
    page.wait_for_function(
        "() => Boolean(window.MosharrofPersonalMemory && window.MosharrofPersonalMemory.list)",
        timeout=30000,
    )
    page.evaluate("window.MosharrofPersonalMemory.setEnabled(true)")
    page.locator("#input").fill(first_message)
    page.locator("#sendBtn").click()
    page.wait_for_function(
        """async (marker) => {
          const api = window.MosharrofPersonalMemory;
          if (!api) return false;
          const rows = await api.list(500);
          return rows.some(row => row.kind === "user" && row.text.includes(marker)) &&
                 rows.some(row => row.kind === "assistant" && row.text.includes("Browser memory smoke test reply."));
        }""",
        arg=marker,
        timeout=30000,
    )
    assert captured_requests, "chat composer did not issue a request intercepted by the smoke test"
    assert "memory_context" in captured_requests[0], "memory bridge did not attach its context field"

    page.reload(wait_until="domcontentloaded", timeout=60000)
    page.wait_for_function(
        "() => Boolean(window.MosharrofPersonalMemory && window.MosharrofPersonalMemory.list)",
        timeout=30000,
    )
    page.wait_for_function(
        """async (marker) => {
          const rows = await window.MosharrofPersonalMemory.list(500);
          return rows.some(row => row.kind === "user" && row.text.includes(marker));
        }""",
        arg=marker,
        timeout=30000,
    )
    follow_up = "What phrase did I ask you to remember?"
    page.locator("#input").fill(follow_up)
    page.locator("#sendBtn").click()
    page.wait_for_function(
        """async () => {
          const rows = await window.MosharrofPersonalMemory.list(500);
          return rows.some(row => row.kind === "user" && row.text.includes("What phrase did I ask you to remember?"));
        }""",
        timeout=30000,
    )
    assert len(captured_requests) >= 2, "follow-up chat request was not intercepted"
    context = str(captured_requests[-1].get("memory_context", ""))
    assert marker in context, "stored memory was not recalled into the follow-up chat context after reload"
    print("PERSONAL MEMORY CHAT → INDEXEDDB → RELOAD → RECALL CHECK: PASS")

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
        check_composer_expansion(page)
        browser.close()

    print("LIVE ORGAN RUNTIME BROWSER HEALTH CHECK: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
