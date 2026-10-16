#!/usr/bin/env python3
"""Opt-in browser smoke test for live chat memory persistence.

This sends one clearly labelled test message to the configured site. Run only
when an authorized operator intentionally wants to exercise the live chat.
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError


DEFAULT_URL = "https://mosharrof0000-ux.github.io/Mosharrof/"


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--timeout-ms", type=int, default=120_000)
    parser.add_argument("--evidence", default="artifacts/live-memory-smoke.txt")
    args = parser.parse_args()

    marker = "MOSHARROF_MEMORY_SMOKE_TEST_" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    evidence = Path(args.evidence)
    evidence.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"url={args.url}", f"marker={marker}"]

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        context = await browser.new_context(viewport={"width": 412, "height": 915})
        page = await context.new_page()
        try:
            response = await page.goto(args.url, wait_until="domcontentloaded", timeout=args.timeout_ms)
            if response is None or response.status >= 400:
                raise RuntimeError(f"Live site navigation failed: HTTP {response.status if response else 'no response'}")
            await page.wait_for_selector("#input", timeout=args.timeout_ms)
            await page.wait_for_function(
                "() => !!window.MosharrofPersonalMemory && typeof window.MosharrofPersonalMemory.list === 'function'",
                timeout=args.timeout_ms,
            )
            enabled = await page.evaluate("() => window.MosharrofPersonalMemory.enabled()")
            if not enabled:
                await page.evaluate("() => window.MosharrofPersonalMemory.setEnabled(true)")
            await page.locator("#input").fill(
                f"{marker} — এটি স্বয়ংক্রিয় মেমোরি-পারসিস্টেন্স পরীক্ষা; শুধু এই পরীক্ষার বার্তাটি মনে রাখো।"
            )
            await page.locator("#sendBtn").click()
            await page.wait_for_function(
                """marker => {
                    const list = document.querySelector('#messages');
                    return !!list && list.innerText.includes(marker);
                }""",
                arg=marker,
                timeout=args.timeout_ms,
            )
            await page.wait_for_function(
                """marker => window.MosharrofPersonalMemory.list(500).then(rows =>
                    rows.some(row => String(row.text || '').includes(marker)))""",
                arg=marker,
                timeout=args.timeout_ms,
            )
            lines.append("sent_and_saved_before_reload=true")
            await page.reload(wait_until="domcontentloaded", timeout=args.timeout_ms)
            await page.wait_for_function(
                "() => !!window.MosharrofPersonalMemory && typeof window.MosharrofPersonalMemory.list === 'function'",
                timeout=args.timeout_ms,
            )
            await page.wait_for_function(
                """marker => window.MosharrofPersonalMemory.list(500).then(rows =>
                    rows.some(row => String(row.text || '').includes(marker)))""",
                arg=marker,
                timeout=args.timeout_ms,
            )
            lines.append("persisted_after_reload=true")
            lines.append("result=PASS")
            print("\n".join(lines))
        except Exception as exc:
            lines.extend([f"result=FAIL", f"error={type(exc).__name__}: {exc}"])
            print("\n".join(lines))
            evidence.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return 1
        finally:
            await context.close()
            await browser.close()

    evidence.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
