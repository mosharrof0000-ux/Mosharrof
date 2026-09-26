const { chromium } = require("playwright");
const fs=require("fs");
const url=process.argv[2]||"http://127.0.0.1:4173/";
const out=process.argv[3]||"artifacts/candidate";
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 const page=await context.newPage(); const errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 await page.goto(url,{waitUntil:"networkidle",timeout:60000});
 await page.screenshot({path:out+"/mobile.png",fullPage:true});
 await page.screenshot({path:out+"/mobile-notch.png",fullPage:true});
 await page.setViewportSize({width:1440,height:900});
 await page.reload({waitUntil:"networkidle"});
 await page.screenshot({path:out+"/desktop.png",fullPage:true});
 const elements=await page.evaluate(()=>{
  const q=s=>!!document.querySelector(s);
  const pseudo=(sel,p)=>{const e=document.querySelector(sel);return !!e&&getComputedStyle(e,p).content!=="none"};
  return {header:q(".header"),composer:q(".composer"),messages:q(".messages"),drawer:q(".drawer"),
          fadeTop:pseudo(".messages","::before"),fadeBottom:pseudo(".messages","::after")};
 });
 const title=await page.title(), text=await page.locator("body").innerText();
 const page_ok=title.length>0&&text.length>30&&errors.length===0;
 fs.writeFileSync(out+"/report.json",JSON.stringify({url,title,page_ok,errors,elements,captured_at:new Date().toISOString()},null,2));
 await browser.close(); if(!page_ok)process.exit(1);
})();