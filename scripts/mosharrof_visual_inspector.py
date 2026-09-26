#!/usr/bin/env python3
import argparse, base64, json, os, sys
from pathlib import Path

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--url",required=True)
    p.add_argument("--baseline-url",default=os.environ.get("LIVE_URL","https://mosharrof0000-ux.github.io/Mosharrof/"))
    p.add_argument("--out",default="artifacts/visual-inspection")
    a=p.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is required.",file=sys.stderr); return 2
    out=Path(a.out); out.mkdir(parents=True,exist_ok=True)
    report={"candidate_url":a.url,"baseline_url":a.baseline_url,"checks":[]}
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        def capture(url,name):
            page=browser.new_page(viewport={"width":390,"height":844},device_scale_factor=1)
            page.goto(url,wait_until="networkidle",timeout=60000)
            page.screenshot(path=str(out/name),full_page=False)
            checks=[
              ("header",page.locator(".header").count()>0),
              ("composer",page.locator(".composer").count()>0),
              ("messages",page.locator(".messages").count()>0),
              ("floating-message-layout",page.locator(".message").count()>0),
            ]
            overflow=page.evaluate("() => ({width:document.documentElement.scrollWidth,viewport:window.innerWidth})")
            page.close()
            return checks, overflow
        try:
            baseline_checks, baseline_overflow=capture(a.baseline_url,"live.png")
            report["baseline_available"]=True
        except Exception as e:
            report["baseline_available"]=False
            report["baseline_error"]=str(e)
            baseline_checks=[]; baseline_overflow={}
        candidate_checks, overflow=capture(a.url,"candidate.png")
        for name,ok in candidate_checks:
            report["checks"].append({"name":name,"pass":bool(ok)})
        report["horizontal_overflow"]=overflow["width"]>overflow["viewport"]+2
        report["checks"].append({"name":"no-horizontal-overflow","pass":not report["horizontal_overflow"]})
        browser.close()

    # Optional AI visual comparison. If unavailable, deterministic checks still run.
    key=os.environ.get("GEMINI_API_KEY")
    if key and report.get("baseline_available"):
        try:
            def b64(path): return base64.b64encode(path.read_bytes()).decode()
            prompt="""Compare these two mobile screenshots of Mosharrof.
IMAGE 1 = current/live baseline. IMAGE 2 = proposed candidate.
Look only for concrete regressions: missing controls, clipping, overflow, overlap,
broken text, unsafe top/bottom safe-area behavior, broken floating/no-card chat,
or previously working UI being removed. Intentional visual changes are allowed.
Return JSON only:
{"pass":true/false,"defects":[],"changes":[],"reason":"..."}"""
            payload=json.dumps({"contents":[{"parts":[
                {"text":prompt},
                {"inline_data":{"mime_type":"image/png","data":b64(out/"live.png")}},
                {"inline_data":{"mime_type":"image/png","data":b64(out/"candidate.png")}}
            ]}],"generationConfig":{"temperature":0.0,"responseMimeType":"application/json"}}).encode()
            import urllib.request
            req=urllib.request.Request(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                data=payload,
                headers={"Content-Type":"application/json","x-goog-api-key":key})
            with urllib.request.urlopen(req,timeout=120) as r:
                data=json.load(r)
            report["ai_visual_review"]=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
        except Exception as e:
            report["ai_visual_review_error"]=str(e)

    (out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if any(not x["pass"] for x in report["checks"]): return 1
    if report.get("ai_visual_review") and not report["ai_visual_review"].get("pass",False): return 1
    return 0

if __name__=="__main__":
    raise SystemExit(main())
