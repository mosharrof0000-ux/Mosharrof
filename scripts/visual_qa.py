#!/usr/bin/env python3
import argparse,base64,json,os,sys,urllib.request
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
VIEWPORTS={"mobile":{"width":412,"height":915},"desktop":{"width":1440,"height":900}}
def shot(url,path,viewport):
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_page(viewport=viewport,device_scale_factor=1,is_mobile=viewport["width"]<700)
        page.goto(url,wait_until="networkidle",timeout=60000)
        page.screenshot(path=str(path),full_page=False)
        title=page.title();html=page.locator("body").inner_text(timeout=10000)
        browser.close()
    return title,html
def compare(a,b):
    ia,ib=Image.open(a).convert("RGB"),Image.open(b).convert("RGB")
    if ia.size!=ib.size:return 1.0
    s=ImageStat.Stat(ImageChops.difference(ia,ib))
    return sum(s.mean)/(255.0*3)
def review(candidate,baseline):
    key=os.environ.get("GEMINI_API_KEY")
    if not key:return {"status":"SKIPPED"}
    enc=lambda p:base64.b64encode(Path(p).read_bytes()).decode()
    prompt='''Visual QA: first image is stable baseline, second is proposed. Check clipping, missing controls, overlaps, responsiveness, composer visibility, status/header safety, and floating-text fade. Do not fail for expected color or dynamic-text changes. Return JSON only: {"status":"PASS" or "FAIL","issues":[],"new_feature_visible":true}'''
    payload={"contents":[{"parts":[{"text":prompt},{"inline_data":{"mime_type":"image/png","data":enc(baseline)}},{"inline_data":{"mime_type":"image/png","data":enc(candidate)}}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}
    req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=json.dumps(payload).encode(),headers={"Content-Type":"application/json","x-goog-api-key":key})
    try:
        with urllib.request.urlopen(req,timeout=120) as r:return json.loads(json.load(r)["candidates"][0]["content"]["parts"][0]["text"])
    except Exception as e:return {"status":"ERROR","reason":str(e)}
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--candidate",required=True);ap.add_argument("--baseline",required=True);ap.add_argument("--output",required=True);a=ap.parse_args()
    out=Path(a.output);out.mkdir(parents=True,exist_ok=True);verdict="PASS";report=[];ai={}
    required=["MOSHARROF AI","জ্ঞান সঙ্গী, তোমার জ্ঞানের পথে","আপনার প্রশ্ন লিখুন"]
    for name,vp in VIEWPORTS.items():
        c=out/f"candidate-{name}.png";b=out/f"baseline-{name}.png";ct,ch=shot(a.candidate,c,vp);bt,bh=shot(a.baseline,b,vp);ratio=compare(c,b);missing=[x for x in required if x not in ch]
        report.append({"viewport":name,"pixel_difference_mean":ratio,"missing":missing})
        if missing or ratio>0.28:verdict="FAIL"
        ai[name]=review(c,b)
        if ai[name].get("status")=="FAIL":verdict="FAIL"
    (out/"report.json").write_text(json.dumps({"deterministic":report,"gemini":ai,"verdict":verdict},ensure_ascii=False,indent=2),encoding="utf-8")
    (out/"VERDICT.txt").write_text(verdict+"\\n",encoding="utf-8");print(verdict);sys.exit(0 if verdict=="PASS" else 1)
if __name__=="__main__":main()
