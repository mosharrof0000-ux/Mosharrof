#!/usr/bin/env python3
"""Run a real chat round-trip inside the installed MOSHARROF Android APK WebView."""
from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.async_api import async_playwright


PROMPT = "অ্যান্ড্রয়েড APK চ্যাট পরীক্ষা। অনুগ্রহ করে শুধু লিখুন: APK চ্যাট পরীক্ষা সফল।"
ERROR_MARKERS = (
    "connection problem",
    "quota exceeded",
    "api error",
    "no provider",
    "fallback failed",
    "সার্ভার সমস্যা",
    "কোটা শেষ",
    "সংযোগ সমস্যা",
    "mock assistant",
)


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cdp-endpoint", default="http://127.0.0.1:9222")
    parser.add_argument("--output-dir", default="artifacts/apk-chat")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    report: dict = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "target": "installed MOSHARROF Android APK WebView",
        "cdp_endpoint": args.cdp_endpoint,
        "prompt": PROMPT,
        "passed": False,
        "checks": {},
        "errors": [],
        "request_failures": [],
        "page_errors": [],
        "console_errors": [],
    }
    browser = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.connect_over_cdp(args.cdp_endpoint, timeout=20000)
            pages = [page for context in browser.contexts for page in context.pages]
            report["discovered_pages"] = [{"url": page.url, "title": await page.title()} for page in pages]
            page = None
            for candidate in pages:
                try:
                    await candidate.wait_for_selector("#input", state="visible", timeout=7000)
                    await candidate.wait_for_selector("#sendBtn", state="visible", timeout=3000)
                    page = candidate
                    break
                except Exception:
                    continue
            if page is None:
                raise RuntimeError("No existing APK WebView page exposed #input and #sendBtn; remote debugging or app startup may be blocked.")

            report["page_url"] = page.url
            report["page_title"] = await page.title()
            page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
            page.on(
                "console",
                lambda message: report["console_errors"].append(message.text)
                if message.type == "error"
                else None,
            )
            page.on(
                "requestfailed",
                lambda request: report["request_failures"].append(
                    {"url": request.url, "failure": request.failure}
                ),
            )

            await page.wait_for_function(
                "() => typeof window.MosharrofPersonalMemory !== 'undefined'",
                timeout=15000,
            )
            report["checks"]["chat_composer_visible"] = await page.locator("#input").is_visible()
            report["checks"]["send_button_visible"] = await page.locator("#sendBtn").is_visible()
            report["checks"]["memory_api_available"] = True
            await page.screenshot(path=str(output_dir / "apk-chat-before.png"), full_page=True)

            baseline_count = await page.locator("#messages .message.ai:not(.typing)").count()
            await page.locator("#input").fill(PROMPT)
            await page.locator("#sendBtn").click()
            await page.wait_for_function(
                """(baseline) => {
                    const replies = document.querySelectorAll('#messages .message.ai:not(.typing)');
                    const input = document.querySelector('#input');
                    const send = document.querySelector('#sendBtn');
                    const typing = document.querySelector('#messages .message.ai.typing');
                    return replies.length > baseline && !typing && input &&
                        input.value.trim() === '' && send && !send.disabled &&
                        (replies[replies.length - 1].innerText || '').trim().length > 0;
                }""",
                baseline_count,
                timeout=60000,
            )
            replies = page.locator("#messages .message.ai:not(.typing)")
            answer = (await replies.last.inner_text()).strip()
            report["response_preview"] = answer[:500]
            report["response_provider"] = await replies.last.get_attribute("data-provider")
            report["checks"]["real_chat_reply_received"] = bool(answer)
            report["checks"]["reply_not_mock_or_error"] = not any(
                marker in answer.lower() for marker in ERROR_MARKERS
            )
            try:
                await page.wait_for_function(
                    "() => window.MosharrofPersonalMemory.list().length > 0",
                    timeout=10000,
                )
                report["checks"]["memory_saved"] = True
                report["memory_rows"] = await page.evaluate(
                    "() => window.MosharrofPersonalMemory.list().length"
                )
            except Exception:
                report["checks"]["memory_saved"] = False
                report["memory_rows"] = 0
            await page.screenshot(path=str(output_dir / "apk-chat-after.png"), full_page=True)

            required = (
                "chat_composer_visible",
                "send_button_visible",
                "memory_api_available",
                "real_chat_reply_received",
                "reply_not_mock_or_error",
                "memory_saved",
            )
            report["passed"] = all(report["checks"].get(name) is True for name in required)
            if not report["checks"]["reply_not_mock_or_error"]:
                report["errors"].append("The assistant reply contains a provider/mock/error marker.")
            if not report["checks"]["memory_saved"]:
                report["errors"].append("The chat reply arrived, but the browser memory round-trip was not confirmed.")
    except Exception as exc:
        report["errors"].append(f"{type(exc).__name__}: {exc}")
    finally:
        if browser is not None:
            try:
                await browser.close()
            except Exception:
                pass
        (output_dir / "apk-chat-report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
