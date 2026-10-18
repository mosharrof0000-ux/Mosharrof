#!/usr/bin/env python3
"""Safe, evidence-producing interactive QA for the deployed MOSHARROF web/PWA.

Default mode is read-only: inspect visible controls, exercise reversible menus,
record console/network failures, screenshots and a JSON inventory. A real chat
probe is opt-in through MOSHARROF_QA_SEND_MESSAGE=1 because it calls the live
chat provider and may consume quota.
"""
from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get(
    "PAGE_URL", "https://mosharrof0000-ux.github.io/Mosharrof/"
).strip()
OUT = Path(os.environ.get("QA_OUTPUT_DIR", "qa-artifacts"))
SEND_MESSAGE = os.environ.get("MOSHARROF_QA_SEND_MESSAGE", "0").lower() in {
    "1", "true", "yes", "on"
}
TEST_MESSAGE = os.environ.get(
    "MOSHARROF_QA_MESSAGE",
    "MOSHARROF QA পরীক্ষা: শুধু সংক্ষিপ্তভাবে বলুন—চ্যাট উত্তর দিচ্ছে।",
)
OUT.mkdir(parents=True, exist_ok=True)


def main() -> int:
    parsed = urlparse(BASE_URL)
    if parsed.scheme != "https" or not parsed.netloc:
        raise SystemExit("PAGE_URL must be a valid HTTPS URL")
    report = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "target": BASE_URL,
        "mode": "live-chat-probe" if SEND_MESSAGE else "read-only-interactive-audit",
        "checks": [],
        "console_errors": [],
        "page_errors": [],
        "failed_requests": [],
        "http_errors": [],
        "controls": [],
        "screenshots": [],
    }

    def check(name: str, passed: bool, detail: str = "") -> None:
        report["checks"].append(
            {"name": name, "status": "PASS" if passed else "FAIL", "detail": detail}
        )
        print(f'{"PASS" if passed else "FAIL"}: {name}' + (f" — {detail}" if detail else ""))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": 412, "height": 915},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
            permissions=[],
        )
        page = context.new_page()
        page.set_default_timeout(8000)
        page.on("pageerror", lambda err: report["page_errors"].append(str(err)))
        page.on(
            "console",
            lambda msg: report["console_errors"].append(msg.text)
            if msg.type == "error" else None,
        )
        page.on(
            "requestfailed",
            lambda req: report["failed_requests"].append(
                {"url": req.url, "failure": req.failure}
            ),
        )
        page.on(
            "response",
            lambda res: report["http_errors"].append(
                {"status": res.status, "url": res.url}
            ) if res.status >= 400 else None,
        )

        response = page.goto(BASE_URL, wait_until="domcontentloaded", timeout=60000)
        check("live page HTTP response", bool(response and response.status < 400),
              str(response.status if response else "no response"))
        page.wait_for_timeout(2500)
        title = page.title()
        check("document title exists", bool(title.strip()), title)
        check("chat composer exists", page.locator("#input").count() == 1)
        check("send control exists", page.locator("#sendBtn").count() == 1)
        check("voice control exists", page.locator("#composerVoiceBtn").count() == 1)
        check("image attachment input exists", page.locator("#imageInput").count() == 1)
        check("left navigation control exists", page.locator("#leftBtn").count() == 1)
        check("right options control exists", page.locator("#rightBtn").count() == 1)
        check("message region exists", page.locator("#messages").count() == 1)

        # Inventory all interactive elements without triggering potentially
        # destructive actions (delete, clear, send, external navigation).
        report["controls"] = page.locator(
            "button, input, textarea, select, [role=button], [role=menuitem], a[href]"
        ).evaluate_all("""els => els.map((el, i) => ({
          index: i,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          role: el.getAttribute('role'),
          label: (el.getAttribute('aria-label') || el.innerText ||
                  el.getAttribute('title') || el.getAttribute('placeholder') || '')
                    .trim().replace(/\s+/g, ' ').slice(0, 160),
          disabled: !!el.disabled,
          visible: !!(el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'),
          href: el.tagName === 'A' ? el.getAttribute('href') : null
        }))""")
        report["screenshots"].append("initial-mobile.png")
        page.screenshot(path=str(OUT / "initial-mobile.png"), full_page=True)

        # Reversible interaction checks: open each drawer, then close with Escape.
        for label, selector, drawer_selector in (
            ("main menu opens", "#leftBtn", "#drawerLeft"),
            ("options menu opens", "#rightBtn", "#drawerRight"),
        ):
            try:
                page.locator(selector).click()
                page.wait_for_timeout(300)
                drawer = page.locator(drawer_selector)
                opened = drawer.count() == 1 and drawer.get_attribute("aria-hidden") != "true"
                check(label, opened, f"aria-hidden={drawer.get_attribute('aria-hidden') if drawer.count() else 'missing'}")
                page.keyboard.press("Escape")
                page.wait_for_timeout(200)
                report["screenshots"].append(re.sub(r"[^a-z0-9]+", "-", label.lower()) + ".png")
                page.screenshot(path=str(OUT / report["screenshots"][-1]), full_page=True)
            except Exception as exc:
                check(label, False, str(exc)[:240])

        try:
            plus = page.locator("#plusBtn")
            plus.click()
            opened = page.locator("#composerToolsMenu").evaluate(
                "(el) => getComputedStyle(el).display !== 'none' && el.classList.contains('open')"
            )
            check("composer tools open", opened)
            plus.click()
            closed = not page.locator("#composerToolsMenu").evaluate(
                "(el) => el.classList.contains('open')"
            )
            check("composer tools close", closed)
        except Exception as exc:
            check("composer tools toggle", False, str(exc)[:240])

        # Exercise each registered sidebar module control one at a time. These are
        # navigation actions (not delete/clear/send actions); each gets a screenshot
        # and a page-exception delta so module-specific failures are attributable.
        module_controls = page.locator("#drawerLeft [data-module]").evaluate_all(
            """els => els.map(el => ({
              id: el.getAttribute('data-module') || '',
              label: (el.innerText || el.getAttribute('aria-label') || '').trim()
                .replace(/\s+/g, ' ').slice(0, 100)
            })).filter(item => item.id)"""
        )
        report["module_interactions"] = []
        check("sidebar module controls discovered", bool(module_controls), f"{len(module_controls)} modules")
        for module in module_controls:
            module_id = module["id"]
            outcome = {
                "id": module_id,
                "label": module["label"],
                "clicked": False,
                "page_errors_before": len(report["page_errors"]),
            }
            try:
                drawer = page.locator("#drawerLeft")
                if drawer.count() and drawer.get_attribute("aria-hidden") == "true":
                    page.locator("#leftBtn").click()
                    page.wait_for_timeout(200)
                target = page.locator(f'#drawerLeft [data-module="{module_id}"]').first
                target.click()
                outcome["clicked"] = True
                page.wait_for_timeout(600)
                outcome["page_errors_after"] = len(report["page_errors"])
                outcome["new_page_errors"] = report["page_errors"][outcome["page_errors_before"]:]
                outcome["active_state"] = target.get_attribute("aria-current") or target.get_attribute("aria-pressed")
                shot = "module-" + re.sub(r"[^a-z0-9-]+", "-", module_id.lower()).strip("-") + ".png"
                page.screenshot(path=str(OUT / shot), full_page=True)
                report["screenshots"].append(shot)
                check("module interaction: " + module_id,
                      outcome["clicked"] and not outcome["new_page_errors"],
                      module["label"] or "navigation control clicked")
            except Exception as exc:
                outcome["error"] = str(exc)[:240]
                check("module interaction: " + module_id, False, outcome["error"])
            report["module_interactions"].append(outcome)

        # Accessibility smoke checks on visible controls: accessible name and
        # keyboard focusability. These are diagnostics, not automatic failures
        # for icon-only decorative controls that intentionally lack labels.
        unlabeled = [
            c for c in report["controls"]
            if c["visible"] and c["tag"] in {"button", "input", "textarea", "select"}
            and not c["label"] and c["tag"] != "input"
        ]
        report["unlabeled_visible_controls"] = unlabeled
        check("visible control inventory captured", len(report["controls"]) > 0,
              f'{len(report["controls"])} controls; {len(unlabeled)} visible unlabeled controls')

        if SEND_MESSAGE:
            before = page.locator("#messages").inner_text()
            before_ai_count = page.locator("#messages .message.ai:not(.typing)").count()
            try:
                page.locator("#input").fill(TEST_MESSAGE)
                page.locator("#sendBtn").click()
                try:
                    page.wait_for_function(
                        """before => {
                          const box = document.querySelector('#messages');
                          const input = document.querySelector('#input');
                          const send = document.querySelector('#sendBtn');
                          const current = box ? box.innerText : '';
                          return current !== before && input && !input.value.trim()
                            && send && !send.disabled;
                        }""",
                        arg=before,
                        timeout=90000,
                    )
                    after = page.locator("#messages").inner_text()
                    check("live chat returned from pending state", after != before,
                          "message list changed and send control re-enabled")
                    report["chat_probe"] = {
                        "sent": True,
                        "test_message": TEST_MESSAGE,
                        "message_region_changed": after != before,
                        "tail": after[-1800:],
                    }
                    report["screenshots"].append("after-chat-probe.png")
                    page.screenshot(path=str(OUT / "after-chat-probe.png"), full_page=True)
                except PlaywrightTimeoutError:
                    check("live chat returned from pending state", False,
                          "timed out after 90s; inspect screenshot and network evidence")
                    report["chat_probe"] = {
                        "sent": True, "test_message": TEST_MESSAGE, "timed_out": True,
                        "tail": page.locator("#messages").inner_text()[-1800:],
                    }
                    page.screenshot(path=str(OUT / "chat-probe-timeout.png"), full_page=True)
            except Exception as exc:
                check("live chat probe", False, str(exc)[:300])
        else:
            report["chat_probe"] = {
                "sent": False,
                "reason": "read-only mode; enable MOSHARROF_QA_SEND_MESSAGE for an explicit live test",
            }

        check("no uncaught page exceptions", not report["page_errors"],
              "; ".join(report["page_errors"][:5]))
        # Browser console/network errors are retained as evidence; third-party
        # and expected optional-resource failures may need triage rather than
        # blindly failing the entire run.
        report["finished_at"] = datetime.now(timezone.utc).isoformat()
        report["summary"] = {
            "passed": sum(c["status"] == "PASS" for c in report["checks"]),
            "failed": sum(c["status"] == "FAIL" for c in report["checks"]),
            "total": len(report["checks"]),
            "controls": len(report["controls"]),
            "console_errors": len(report["console_errors"]),
            "page_errors": len(report["page_errors"]),
            "failed_requests": len(report["failed_requests"]),
            "http_errors": len(report["http_errors"]),
        }
        (OUT / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        browser.close()

    print(json.dumps(report["summary"], ensure_ascii=False))
    return 1 if report["summary"]["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
