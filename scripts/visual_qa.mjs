import { chromium } from "playwright";
import fs from "node:fs";
const target=process.argv[2];
if(!target) throw new Error("Target URL required");
fs.mkdirSync("visual-qa",{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
for(const [name,viewport] of [["mobile",{width:412,height:915,isMobile:true,deviceScaleFactor:1}],["desktop",{width:1440,height:900,isMobile:false,deviceScaleFactor:1}]]){
 const page=await browser.newPage({viewport});
 const errors=[]; page.on("pageerror",e=>errors.push(String(e)));
 const response=await page.goto(target,{waitUntil:"networkidle",timeout:60000});
 await page.screenshot({path:"visual-qa/"+name+".png",fullPage:true});
 const metrics=await page.evaluate(()=>({title:document.title,width:document.documentElement.scrollWidth,viewport:innerWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2}));
 results.push({name,status:response?.status()??null,errors,metrics});
 await page.close();
}
await browser.close();
fs.writeFileSync("visual-qa/visual-report.json",JSON.stringify({target,timestamp:new Date().toISOString(),results},null,2));
for(const r of results){if(r.status!==200)throw new Error(r.name+" HTTP status "+r.status);if(r.errors.length)throw new Error(r.name+" browser errors: "+r.errors.join("; "));if(r.metrics.horizontalOverflow)throw new Error(r.name+" horizontal overflow detected");}
console.log("VISUAL QA PASS");
