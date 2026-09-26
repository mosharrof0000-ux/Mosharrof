#!/usr/bin/env python3
import json, os
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

OUT=Path("artifacts/visual-qa"); OUT.mkdir(parents=True,exist_ok=True)
candidate_url=os.environ.get("MOSHARROF_QA_URL","http://127.0.0.1:4174/")
base_url=os.environ.get("MOSHARROF_BASE_URL","http://127.0.0.1:4173/")

def shot(page,url,path):
    page.goto(url,wait_until="networkidle",timeout=30000)
    # Freeze the animated presentation so both renders are comparable.
    page.add_style_tag(content="*{animation:none!important;transition:none!important}")
    page.screenshot(path=str(path),full_page=True)

with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1)

    shot(page,base_url,OUT/"baseline-mobile.png")
    base_text=page.locator("body").inner_text()

    shot(page,candidate_url,OUT/"current-mobile.png")
    current_text=page.locator("body").inner_text()

    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.screenshot(path=str(OUT/"current-mobile-bottom.png"),full_page=True)

    result={
      "baseline_url":base_url,
      "candidate_url":candidate_url,
      "missing_required":[x for x in ["MOSHARROF AI","আপনার প্রশ্ন লিখুন"] if x not in current_text],
      "removed_visible_text":[x for x in set(base_text.splitlines()) if x.strip() and x not in current_text][:80],
      "horizontal_overflow":page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 2"),
      "header_visible":page.locator("header").is_visible(),
      "composer_visible":page.locator(".composer").is_visible()
    }
    browser.close()

a=Image.open(OUT/"baseline-mobile.png").convert("RGB")
b=Image.open(OUT/"current-mobile.png").convert("RGB")
if a.size==b.size:
    diff=ImageChops.difference(a,b)
    stat=ImageStat.Stat(diff)
    # Mean absolute RGB difference, normalized to 0..1.
    mean=sum(stat.mean)/(3*255)
    result["visual_mean_difference"]=round(mean,4)
    diff.save(OUT/"difference.png")
else:
    result["visual_size_changed"]={"baseline":a.size,"candidate":b.size}
    mean=1.0

(OUT/"result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")

if result["missing_required"]:
    raise SystemExit("Visual QA blocked: required UI missing.")
if result["horizontal_overflow"]:
    raise SystemExit("Visual QA blocked: horizontal overflow.")
if not result["header_visible"] or not result["composer_visible"]:
    raise SystemExit("Visual QA blocked: fixed UI missing.")
if result["removed_visible_text"]:
    raise SystemExit("Visual QA blocked: visible content disappeared from main baseline.")
if mean > 0.35:
    raise SystemExit("Visual QA blocked: rendered screen changed substantially from current main.")

print(json.dumps(result,ensure_ascii=False,indent=2))
