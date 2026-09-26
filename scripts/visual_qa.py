#!/usr/bin/env python3
import json, os
from pathlib import Path
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

OUT=Path("artifacts/visual-qa"); OUT.mkdir(parents=True,exist_ok=True)
url=os.environ.get("MOSHARROF_QA_URL","http://127.0.0.1:4173/")

with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1)
    page.goto(url,wait_until="networkidle",timeout=30000)
    page.screenshot(path=str(OUT/"current-mobile.png"),full_page=True)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.screenshot(path=str(OUT/"current-mobile-bottom.png"),full_page=True)
    body=page.locator("body").inner_text()
    result={"url":url,"title":page.title(),
            "missing_text":[x for x in ["MOSHARROF AI","আপনার প্রশ্ন লিখুন"] if x not in body],
            "horizontal_overflow":page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 2"),
            "header_visible":page.locator("header").is_visible(),
            "composer_visible":page.locator(".composer").is_visible()}
    browser.close()

(OUT/"result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
if result["missing_text"]: raise SystemExit("Visual QA failed: required UI missing")
if result["horizontal_overflow"]: raise SystemExit("Visual QA failed: horizontal overflow")
if not (result["header_visible"] and result["composer_visible"]): raise SystemExit("Visual QA failed: fixed UI missing")

baseline=Path("visual-baseline/mobile.png")
if baseline.exists():
    a=Image.open(baseline).convert("RGB"); b=Image.open(OUT/"current-mobile.png").convert("RGB")
    if a.size==b.size:
        diff=ImageChops.difference(a,b); changed=sum(1 for px in diff.getdata() if px!=(0,0,0))/(a.width*a.height)
        result["baseline_changed_pixel_ratio"]=changed
        diff.save(OUT/"difference.png")
        (OUT/"result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
        if changed>0.35: raise SystemExit("Visual QA blocked: large visual change from baseline")
print(json.dumps(result,ensure_ascii=False,indent=2))
