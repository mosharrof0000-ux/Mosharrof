import { chromium } from "playwright";
import fs from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const liveUrl = process.env.LIVE_URL;
fs.mkdirSync("visual-qa", { recursive: true });
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true});
async function capture(url,file){
  const page=await context.newPage();
  const consoleErrors=[];
  page.on("console",m=>{if(m.type()==="error") consoleErrors.push(m.text())});
  page.on("pageerror",e=>consoleErrors.push(String(e)));
  const response=await page.goto(url,{waitUntil:"networkidle",timeout:60000});
  await page.screenshot({path:file,fullPage:false});
  const required={header:await page.locator("header,.header").count(),chat:await page.locator(".messages").count(),composer:await page.locator(".composer").count(),drawer:await page.locator(".drawer").count()};
  const title=await page.title();
  await page.close();
  return {status:response?.status() ?? 0,title,required,consoleErrors};
}
const live=await capture(liveUrl,"visual-qa/live.png");
const candidate=await capture("http://127.0.0.1:4173/","visual-qa/candidate.png");
if(candidate.status!==200) throw new Error("Candidate did not return HTTP 200.");
if(!candidate.required.header || !candidate.required.chat || !candidate.required.composer) throw new Error("Candidate is missing a core UI region.");
if(candidate.consoleErrors.length) throw new Error("Candidate browser errors: "+candidate.consoleErrors.join(" | "));
const a=PNG.sync.read(fs.readFileSync("visual-qa/live.png")); const b=PNG.sync.read(fs.readFileSync("visual-qa/candidate.png"));
if(a.width!==b.width || a.height!==b.height) throw new Error("Screenshot dimensions changed.");
const diff=new PNG({width:a.width,height:a.height});
const changed=pixelmatch(a.data,b.data,diff.data,a.width,a.height,0.16); const ratio=changed/(a.width*a.height);
PNG.sync.write(diff,{path:"visual-qa/diff.png"});
fs.writeFileSync("visual-qa/visual-report.json",JSON.stringify({live,candidate,changedPixels:changed,diffRatio:ratio},null,2));
console.log(JSON.stringify({live,candidate,changedPixels:changed,diffRatio:ratio}));
await browser.close();
