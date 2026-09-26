#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--url",required=True)
    p.add_argument("--out",default="artifacts/visual-inspection")
    a=p.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is required.",file=sys.stderr); return 2
    out=Path(a.out); out.mkdir(parents=True,exist_ok=True)
    report={"url":a.url,"checks":[]}
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        page=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1)
        page.goto(a.url,wait_until="networkidle",timeout=60000)
        page.screenshot(path=str(out/"mobile.png"),full_page=False)
        report["title"]=page.title()
        checks=[
          ("header",page.locator(".header").count()>0),
          ("composer",page.locator(".composer").count()>0),
          ("messages",page.locator(".messages").count()>0),
          ("floating-message-layout",page.locator(".message").count()>0),
        ]
        for name,ok in checks:
            report["checks"].append({"name":name,"pass":bool(ok)})
        overflow=page.evaluate("""() => ({width:document.documentElement.scrollWidth,viewport:window.innerWidth})""")
        report["horizontal_overflow"]=overflow["width"]>overflow["viewport"]+2
        report["checks"].append({"name":"no-horizontal-overflow","pass":not report["horizontal_overflow"]})
        browser.close()
    (out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 1 if any(not x["pass"] for x in report["checks"]) else 0

if __name__=="__main__":
    raise SystemExit(main())
