#!/usr/bin/env python3
"""Exercise the sent-message Read Aloud and generated-audio download controls in Chromium."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "organs/message-audio/tests"))
from playwright.sync_api import sync_playwright
from personal_voice_browser_check import check_personal_voice_menu

PAGE_URL = os.environ["PAGE_URL"]
TTS_URL = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/tts"
AUDIO_RESPONSE = {"audio_data": "AQID", "mime_type": "audio/mpeg"}


def fulfill_tts(route) -> None:
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }
    if route.request.method == "OPTIONS":
        route.fulfill(status=204, headers=headers)
        return
    route.fulfill(
        status=200,
        content_type="application/json",
        headers=headers,
        body=json.dumps(AUDIO_RESPONSE),
    )


def main() -> int:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.route(TTS_URL, fulfill_tts)
        page.goto(PAGE_URL, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_function(
            "() => window.MosharrofEntitySystem && window.MosharrofEntitySystem.ready === true",
            timeout=30000,
        )
        health = page.evaluate("window.MosharrofEntitySystem.organRuntime.health('message-audio')")
        assert health["status"] == "ready", f"message-audio Organ is not ready: {health}"

        page.evaluate("""() => {
          const container = document.querySelector("#messages");
          if (!container) throw new Error("chat message container is missing");
          const message = document.createElement("div");
          message.className = "message user";
          message.dataset.messageAudioFixture = "true";
          const content = document.createElement("div");
          content.className = "message-content";
          content.textContent = "পাঠানো মেসেজের অডিও পরীক্ষা";
          const wrap = document.createElement("div");
          wrap.className = "message-actions-wrap open";
          const group = document.createElement("div");
          group.className = "message-actions";
          group.setAttribute("role", "group");
          wrap.appendChild(group);
          message.append(content, wrap);
          container.appendChild(message);
        }""")
        message = page.locator('.message.user[data-message-audio-fixture="true"]')
        read_button = message.locator("[data-message-audio-read]")
        read_button.wait_for(state="visible", timeout=10000)
        with page.expect_response(
            lambda response: response.url == TTS_URL and response.request.method == "POST",
            timeout=15000,
        ) as response_info:
            read_button.click()
        response = response_info.value
        assert response.status == 200, f"TTS worker returned HTTP {response.status}"

        download_button = message.locator("[data-message-audio-download]")
        download_button.wait_for(state="visible", timeout=10000)
        with page.expect_download(timeout=10000) as download_info:
            download_button.click()
        download = download_info.value
        assert download.suggested_filename.startswith("পাঠানো_মেসেজের_অডিও_পরীক্ষা_"), (
            f"message-derived audio filename is incorrect: {download.suggested_filename}"
        )
        audio_bytes = Path(download.path()).read_bytes()
        assert audio_bytes.startswith(b"ID3"), "MP3 Title metadata is missing"
        assert "MOSHARROF".encode("utf-8") in audio_bytes, "MP3 Artist metadata is missing"
        check_personal_voice_menu(page, read_button)
        print("MESSAGE AUDIO BROWSER CHECK: PASS — sent-message Read Aloud and MP3 download controls work")
        context.close()
        browser.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
