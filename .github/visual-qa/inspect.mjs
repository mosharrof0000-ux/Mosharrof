import { chromium } from "playwright";
import fs from "fs";
import path from "path";
const out="visual-qa-results"; fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const views=[["mobile",390,844],["desktop",1440,900]];
for(const v of views){
 const page=await browser.newPage({viewport:{width:v[1],height:v[2]}});
 const errors=[];
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
 page.on("pageerror",e=>errors.push(String(e)));
 await page.goto(process.env.PREVIEW_URL,{waitUntil:"networkidle"});
 await page.screenshot({path:path.join(out,"preview-"+v[0]+".png"),fullPage:true});
 const required=[".header",".messages",".composer",".drawer"];
 const text=(await page.locator("body").innerText()).slice(0,12000);
 if(errors.length)throw new Error("Browser errors: "+errors.join("\n"));
 if(!text.includes("MOSHARROF"))throw new Error("Mosharrof identity missing");
 for(const s of required)if(await page.locator(s).count()===0)throw new Error("Required UI missing: "+s);
 await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out,"visual-report.json"),JSON.stringify({preview:true},null,2));
console.log("PREVIEW VISUAL QA PASS");
