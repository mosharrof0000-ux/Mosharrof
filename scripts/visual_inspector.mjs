import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const url=process.env.INSPECT_URL || "https://mosharrof0000-ux.github.io/Mosharrof/";
const out="visual-inspection"; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const targets=[{name:"mobile",viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true},{name:"desktop",viewport:{width:1440,height:900},deviceScaleFactor:1,isMobile:false}];
for(const t of targets){
 const context=await browser.newContext({viewport:t.viewport,deviceScaleFactor:t.deviceScaleFactor,isMobile:t.isMobile});
 const page=await context.newPage();
 const errors=[]; page.on("console",m=>{if(m.type()==="error")errors.push(m.text())}); page.on("pageerror",e=>errors.push(String(e)));
 const response=await page.goto(url,{waitUntil:"networkidle",timeout:60000});
 if(!response||!response.ok()) throw new Error("HTTP load failed for "+t.name);
 await page.screenshot({path:path.join(out,t.name+".png"),fullPage:true});
 const checks=await page.evaluate(()=>({title:document.title,width:document.documentElement.scrollWidth,viewport:innerWidth,header:!!document.querySelector(".header"),messages:!!document.querySelector(".messages"),composer:!!document.querySelector(".composer"),drawer:!!document.querySelector(".drawer"),messageCount:document.querySelectorAll(".message").length}));
 const report={status:response.status(),errors,checks}; fs.writeFileSync(path.join(out,t.name+".json"),JSON.stringify(report,null,2));
 if(errors.length) throw new Error(t.name+" browser errors: "+errors.join(" | "));
 if(checks.width>checks.viewport+4) throw new Error(t.name+" horizontal overflow");
 if(!checks.header||!checks.messages||!checks.composer) throw new Error(t.name+" required UI missing");
 await context.close();
}
await browser.close();