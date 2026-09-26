import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const out="visual-qa-results"; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
for(const v of [["live-mobile",390,844],["live-desktop",1440,900]]){
 const page=await browser.newPage({viewport:{width:v[1],height:v[2]}});
 const errors=[];
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 page.on("pageerror",e=>errors.push(String(e)));
 const response=await page.goto(process.env.TARGET_URL,{waitUntil:"networkidle",timeout:60000});
 if(!response||!response.ok())throw new Error("HTTP failure");
 await page.screenshot({path:path.join(out,v[0]+".png"),fullPage:true});
 const text=(await page.locator("body").innerText()).slice(0,12000);
 if(!text.includes("MOSHARROF"))throw new Error("Mosharrof identity missing");
 if(errors.length)throw new Error("Runtime errors: "+errors.join("\n"));
 await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out,"public-report.json"),JSON.stringify({url:process.env.TARGET_URL,inspected:true},null,2));
console.log("PUBLIC VISUAL QA PASS");
