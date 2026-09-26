#!/usr/bin/env python3
import argparse,base64,json,os,sys,urllib.request
from pathlib import Path
def capture(a):
 from playwright.sync_api import sync_playwright
 o=Path(a.out);o.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  b=p.chromium.launch()
  page=b.new_page(viewport={"width":390,"height":844},device_scale_factor=1)
  for n,u in [("candidate",a.candidate),("live",a.live)]:
   page.goto(u,wait_until="networkidle",timeout=60000);page.screenshot(path=str(o/f"{n}-mobile.png"),full_page=True)
  b.close()
def inspect(a):
 k=os.environ.get("GEMINI_API_KEY")
 if not k: raise SystemExit("GEMINI_API_KEY secret is required")
 def enc(x): return base64.b64encode(Path(x).read_bytes()).decode()
 prompt="""Compare CANDIDATE and CURRENT LIVE screenshots for Mosharrof.
Check mobile layout, header/status safe area, drawer, composer, floating text, clipping, overlap, missing existing functions, and whether the requested new UI is present. Ignore intentional color/text differences. Return JSON only:
{"verdict":"PASS|REVIEW|FAIL","critical_issues":[],"regressions":[],"new_features_seen":[],"notes":[]}
FAIL only for clear critical layout/functional regression."""
 body={"contents":[{"parts":[{"text":prompt},{"inline_data":{"mime_type":"image/png","data":enc(a.candidate)}},{"text":"CURRENT LIVE:"},{"inline_data":{"mime_type":"image/png","data":enc(a.live)}}]}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}
 req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=json.dumps(body).encode(),headers={"Content-Type":"application/json","x-goog-api-key":k})
 with urllib.request.urlopen(req,timeout=180) as r: d=json.load(r)
 report=json.loads(d["candidates"][0]["content"]["parts"][0]["text"])
 Path(a.report).parent.mkdir(parents=True,exist_ok=True);Path(a.report).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
 print(json.dumps(report,ensure_ascii=False,indent=2))
def gate(a):
 r=json.loads(Path(a.report).read_text())
 print("Visual verdict:",r.get("verdict"))
 if r.get("verdict")=="FAIL": raise SystemExit(1)
p=argparse.ArgumentParser();s=p.add_subparsers(dest="cmd",required=True)
c=s.add_parser("capture");c.add_argument("--candidate",required=True);c.add_argument("--live",required=True);c.add_argument("--out",required=True)
i=s.add_parser("inspect");i.add_argument("--candidate",required=True);i.add_argument("--live",required=True);i.add_argument("--report",required=True)
g=s.add_parser("gate");g.add_argument("--report",required=True)
a=p.parse_args();{"capture":capture,"inspect":inspect,"gate":gate}[a.cmd](a)
