import { chromium } from "playwright";
import fs from "node:fs";
const url=process.env.TARGET_URL;
if(!url) throw new Error("TARGET_URL is missing");
fs.mkdirSync("visual-qa",{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true});
const response=await page.goto(url,{waitUntil:"networkidle",timeout:60000});
if(!response || !response.ok()) throw new Error("URL did not return a successful response");
await page.waitForTimeout(2500);
await page.screenshot({path:"visual-qa/mobile-current.png",fullPage:true});
const data=await page.evaluate(()=>({
 title:document.title,
 viewport:{width:innerWidth,height:innerHeight},
 bodyText:document.body.innerText.slice(0,12000),
 elements:[...document.querySelectorAll("header,main,.messages,.composer,.drawer,.quick")].map(e=>({selector:e.className||e.tagName,rect:(()=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})(),visible:!!(e.offsetWidth||e.offsetHeight)}))
}));
fs.writeFileSync("visual-qa/current.json",JSON.stringify(data,null,2));
await browser.close();
