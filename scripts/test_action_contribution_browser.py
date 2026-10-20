#!/usr/bin/env python3
"""Browser smoke test for action-bar registration and handler preservation."""
from __future__ import annotations

import os

PAGE_URL = os.environ.get("PAGE_URL", "http://127.0.0.1:4173/").rstrip("/") + "/"


def main() -> int:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        page.goto(PAGE_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function(
            "() => window.MOSHARROF_ACTION_CONTRIBUTIONS && "
            "window.MOSHARROF_ACTION_CONTRIBUTIONS.getStatus().status === 'ready'",
            timeout=20000,
        )
        status = page.evaluate("window.MOSHARROF_ACTION_CONTRIBUTIONS.getStatus()")
        assert status["registeredGroups"] == 1, status
        assert status["registeredContributions"] == 9, status

        page.evaluate("""() => {
          const fixture = document.createElement('section');
          fixture.id = 'action-registry-fixture';
          fixture.className = 'message ai';
          fixture.innerHTML = [
            '<div class="message-actions-wrap open">',
            '<button class="message-actions-toggle" aria-label="মেসেজের কাজ দেখান">⋯</button>',
            '<button class="message-feedback-shortcut" title="লাইক / আনলাইক" aria-label="লাইক বা আনলাইক">♥</button>',
            '<button class="message-feedback-shortcut online-feedback-shortcut" title="অনলাইন ব্যবহারের কারণ" aria-label="অনলাইন ব্যবহারের কারণ">◎</button>',
            '<button class="message-speak-shortcut" aria-label="পড়ে শোনান">🔊</button>',
            '<div class="message-actions" role="group" aria-label="মেসেজ অ্যাকশন">',
            '<button class="message-action" id="test-edit">এডিট</button>',
            '<button class="message-action" id="test-copy">কপি</button>',
            '<button class="message-action">আবার চেষ্টা</button>',
            '<button class="message-action">শেয়ার</button>',
            '<button class="message-action">পড়ে শোনান</button>',
            '</div>',
            '</div>'
          ].join('');
          document.body.appendChild(fixture);
          window.__actionRegistryExistingHandlerCalled = false;
          document.getElementById('test-copy').addEventListener('click', () => {
            window.__actionRegistryExistingHandlerCalled = true;
          });
        }""")
        page.wait_for_function(
            "() => document.querySelectorAll('#action-registry-fixture [data-action-contribution]').length === 9",
            timeout=10000,
        )
        result = page.evaluate("""() => {
          const fixture = document.getElementById('action-registry-fixture');
          const controls = Array.from(fixture.querySelectorAll('[data-action-contribution]'));
          return {
            controls: controls.length,
            groupId: fixture.querySelector('.message-actions').getAttribute('data-menu-group-id'),
            wrongGroup: controls.filter(el => el.getAttribute('data-menu-group-id') !== 'message-actions').length,
            automaticReady: controls.filter(el => el.getAttribute('data-automatic-ready') === 'true').length,
            actionCount: fixture.querySelectorAll('.message-actions .message-action').length
          };
        }""")
        assert result["controls"] == 9, result
        assert result["groupId"] == "message-actions", result
        assert result["wrongGroup"] == 0, result
        assert result["automaticReady"] == 0, result
        assert result["actionCount"] == 5, result

        page.locator("#test-copy").click()
        assert page.evaluate("window.__actionRegistryExistingHandlerCalled") is True, (
            "registry adapter replaced or broke an existing click handler"
        )
        browser.close()

    print("ACTION CONTRIBUTION BROWSER CHECK: PASS — 1 existing group, 9 mapped controls, handlers preserved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
