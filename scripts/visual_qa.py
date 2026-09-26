#!/usr/bin/env python3
import argparse,base64,json,os,urllib.request
from pathlib import Path
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
OUT=Path("visual-qa"); OUT.mkdir(exist_ok=True)
VIEW={"mobile":(390,844),"mobile-wide":(430,932),"desktop":(1440,900)}
def capture(url,prefix):
  with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page()
    for n,(w,h) in VIEW.items():
      page.set_viewport_size({"width":w,"height":h}); page.goto(url,wait_until="networkidle")
      page.screenshot(path=str(OUT/f"{prefix}-{n}.png"),full_page=True)
    b.close()
def compare():
  failures=[]
  for n in VIEW:
    a=Image.open(OUT/f"candidate-{n}.png").convert("RGB"); z=Image.open(OUT/f"baseline-{n}.png").convert("RGB")
    if a.size!=z.size: failures.append(f"{n}: output size changed")
    else:
      d=ImageChops.difference(a,z)
      if d.getbbox():
        h=d.histogram(); changed=sum(v for i,v in enumerate(h) if i%256)
        ratio=changed/max(a.width*a.height*3,1); print(f"{n}: difference={ratio:.4f}")
        if ratio>.70: failures.append(f"{n}: catastrophic visual change")
  if failures: raise SystemExit("\n".join(failures))
def ai_review():
  key=os.environ["GEMINI_API_KEY"]
  parts=[{"text":"""Compare baseline and candidate screenshots as Mosharrof Visual QA.
Check old features, requested new features, clipping, overlap, safe-area/notch issues,
responsive breakage, and unintended major visual changes. Intentional color/spacing changes
are not failures. Return JSON only: {"pass":true,"findings":[],"missing_old_features":[],
"new_features_seen":[],"severity":"none|low|medium|high"}"""}]
  for n in VIEW:
    for pfx in ("baseline","candidate"):
      parts.append({"text":f"{pfx} {n}"})
      parts.append({"inlineData":{"mimeType":"image/png","data":base64.b64encode((OUT/f"{pfx}-{n}.png").read_bytes()).decode()}})
  body=json.dumps({"contents":[{"parts":parts}],"generationConfig":{"temperature":0,"responseMimeType":"application/json"}}).encode()
  req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",data=body,headers={"Content-Type":"application/json","x-goog-api-key":key})
  with urllib.request.urlopen(req,timeout=180) as r: data=json.load(r)
  result=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
  (OUT/"ai-review.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
  print(json.dumps(result,ensure_ascii=False,indent=2))
  if not result.get("pass"): raise SystemExit("AI visual QA failed")
ap=argparse.ArgumentParser(); ap.add_argument("mode"); ap.add_argument("--url",default=""); x=ap.parse_args()
if x.mode=="capture": capture(x.url,"candidate")
elif x.mode=="baseline": capture(x.url,"baseline")
elif x.mode=="compare": compare()
elif x.mode=="ai-review": ai_review()
