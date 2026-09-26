#!/usr/bin/env python3
"""Visual QA for Mosharrof: URL/browser screenshot + AI visual inspection + regression diff."""
import argparse, base64, json, os, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

def capture(url, out):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={"width":390,"height":844}, device_scale_factor=2)
        page.goto(url, wait_until="networkidle", timeout=60000)
        page.screenshot(path=out, full_page=True)
        title=page.title()
        browser.close()
    return title

def ask_gemini(image_paths, task):
    key=os.environ.get("GEMINI_API_KEY")
    if not key: raise SystemExit("GEMINI_API_KEY is required for visual AI review.")
    parts=[{"text":"""You are Mosharrof Visual QA.
Inspect the supplied screenshots and report only evidence visible in them.
Check: layout integrity, clipping/overflow, missing UI, accidental regressions,
text overlap, header/status/composer safety, responsive mobile appearance,
and whether the requested feature appears implemented.
Compare baseline vs candidate when both are present.
Do NOT declare success merely because the page loads.
Return JSON: {"pass":true/false,"issues":[],"observations":[],"regressions":[]}
Task: """+task}]
    for p in image_paths:
        parts.append({"inlineData":{"mimeType":"image/png","data":base64.b64encode(Path(p).read_bytes()).decode()}})
    payload=json.dumps({"contents":[{"parts":parts}],"generationConfig":{"temperature":0.0,"responseMimeType":"application/json"}}).encode()
    req=urllib.request.Request(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
    with urllib.request.urlopen(req,timeout=180) as r: return json.load(r)["candidates"][0]["content"]["parts"][0]["text"]

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--url",required=True)
    ap.add_argument("--baseline")
    ap.add_argument("--output",default="artifacts/candidate.png")
    ap.add_argument("--task",default="Review the current Mosharrof design.")
    a=ap.parse_args()
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    title=capture(a.url,a.output)
    imgs=[a.output]
    if a.baseline and Path(a.baseline).exists(): imgs=[a.baseline,a.output]
    result=ask_gemini(imgs,a.task)
    Path(Path(a.output).parent/"visual-review.json").write_text(result,encoding="utf-8")
    print(result)
    parsed=json.loads(result)
    if not parsed.get("pass",False):
        raise SystemExit("VISUAL QA FAILED")
