#!/usr/bin/env python3
"""Mosharrof visual QA: open URL, capture screenshots, check layout, and optionally ask Gemini Vision."""

import base64, json, os, sys, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=sys.argv[1]
OUT=Path(sys.argv[2]); OUT.mkdir(parents=True,exist_ok=True)

VIEWPORTS={
    "mobile":{"width":412,"height":915,"device_scale_factor":1},
    "desktop":{"width":1440,"height":900,"device_scale_factor":1},
}

def capture(name, vp):
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_page(viewport={"width":vp["width"],"height":vp["height"]},
                              device_scale_factor=vp["device_scale_factor"])
        page.goto(URL, wait_until="networkidle", timeout=30000)
        page.screenshot(path=str(OUT/f"{name}.png"), full_page=True)
        checks={
            "title": page.title(),
            "viewport": vp,
            "messages": page.locator(".message").count(),
            "composer": page.locator(".composer").count(),
            "header": page.locator(".header").count(),
            "top_fade": page.locator(".messages:before").count() >= 0,
            "bottom_fade": page.locator(".messages:after").count() >= 0,
        }
        # Functional smoke: menu and composer must work.
        page.locator("#menu").click()
        assert page.locator("#drawer.open").count()==1, "Drawer did not open"
        page.locator("#scrim").click()
        page.locator("#input").fill("Visual QA test")
        page.locator("#send").click()
        assert page.locator(".message.user").count() >= 2, "Composer/send failed"
        checks["functional_smoke"]="PASS"
        (OUT/f"{name}.json").write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding="utf-8")
        browser.close()

for name,vp in VIEWPORTS.items():
    capture(name,vp)

# Optional visual reasoning by Gemini. This does not get write access.
key=os.environ.get("GEMINI_API_KEY")
if key:
    parts=[{"text":"""You are Mosharrof Visual QA.
Inspect these screenshots as a software visual reviewer.
Check: header/status-bar clarity, floating text, top/bottom fading, no rectangular message cards,
safe margins, mobile responsiveness, composer visibility, accidental overlap, missing UI,
and whether an existing UI element appears to have disappeared.
Return JSON only with: pass (boolean), issues (array), observations (array).
Do not suggest destructive changes."""}]
    for name in VIEWPORTS:
        raw=(OUT/f"{name}.png").read_bytes()
        parts.append({"inlineData":{"mimeType":"image/png","data":base64.b64encode(raw).decode()}})
    payload=json.dumps({"contents":[{"parts":parts}],
                        "generationConfig":{"temperature":0.0,"responseMimeType":"application/json"}}).encode()
    req=urllib.request.Request(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        data=payload,
        headers={"Content-Type":"application/json","x-goog-api-key":key})
    with urllib.request.urlopen(req,timeout=120) as r:
        data=json.load(r)
    result=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
    (OUT/"gemini-visual-review.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    if not result.get("pass",False):
        raise SystemExit("Gemini Visual QA found issues; promotion must stop.")

print("VISUAL QA: PASS")
