#!/usr/bin/env python3
"""Mosharrof Visual QA: screenshot current live and proposed local build, then compare with Gemini vision."""
import json, os, subprocess, time, urllib.request
from pathlib import Path

key=os.environ.get("GEMINI_API_KEY")
if not key:
    raise SystemExit("GEMINI_API_KEY secret is required for visual QA.")

live=os.environ.get("LIVE_URL","https://mosharrof0000-ux.github.io/Mosharrof/")
port="8765"
subprocess.Popen(["python3","-m","http.server",port,"--directory","web"],
                 stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(2)
local=f"http://127.0.0.1:{port}/"

subprocess.run(["npx","--yes","playwright@1.55.0","install","chromium"],check=True)
js=Path("/tmp/visual.js")
js.write_text(r'''
const { chromium } = require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true});
 async function shot(url,file){
   await page.goto(url,{waitUntil:"networkidle",timeout:60000});
   await page.screenshot({path:file,fullPage:false});
   return await page.locator("body").innerText();
 }
 const live=await shot(process.env.LIVE_URL,"/tmp/live.png");
 const local=await shot(process.env.LOCAL_URL,"/tmp/local.png");
 require("fs").writeFileSync("/tmp/live.txt",live);
 require("fs").writeFileSync("/tmp/local.txt",local);
 await browser.close();
})();
''')
subprocess.run(["node",str(js)],env={**os.environ,"LIVE_URL":live,"LOCAL_URL":local},check=True)

def b64(p):
    import base64
    return base64.b64encode(Path(p).read_bytes()).decode()

prompt="""You are Mosharrof Visual QA.
Compare the CURRENT LIVE screenshot with the PROPOSED screenshot.

Determine:
1. Is the proposed page visually functional on a 412x915 mobile screen?
2. Are existing major UI elements still present?
3. Is anything visibly broken, clipped, overlapped, missing, or unexpectedly replaced?
4. Is the requested feature/design visible?
5. Are there severe regressions in header, navigation, chat area, composer, text, or safe-area handling?

Do not judge aesthetics alone. A change is acceptable if intentional and functional.
Return JSON only:
{"pass":true/false,"summary":"...","regressions":[],"new_features":[],"confidence":0.0}
"""
payload=json.dumps({"contents":[{"parts":[
 {"text":prompt},
 {"inlineData":{"mimeType":"image/png","data":b64("/tmp/live.png")}},
 {"text":"CURRENT LIVE"},
 {"inlineData":{"mimeType":"image/png","data":b64("/tmp/local.png")}},
 {"text":"PROPOSED BUILD"}
]}],"generationConfig":{"temperature":0.0,"responseMimeType":"application/json"}}).encode()
req=urllib.request.Request(
 "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
 data=payload,headers={"Content-Type":"application/json","x-goog-api-key":key})
with urllib.request.urlopen(req,timeout=180) as r:
    data=json.load(r)
result=json.loads(data["candidates"][0]["content"]["parts"][0]["text"])
Path("visual-qa-result.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(result,ensure_ascii=False))
if not result.get("pass",False):
    raise SystemExit("VISUAL QA FAILED: "+result.get("summary","unknown regression"))
