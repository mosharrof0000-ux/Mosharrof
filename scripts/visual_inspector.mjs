import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const target = process.argv[2] || "https://mosharrof0000-ux.github.io/Mosharrof/";
const out = "visual-inspection";
fs.mkdirSync(out,{recursive:true});

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});

async function inspect(url,name){
  const result={url,name,ok:false,status:null,title:"",checks:{}};
  try{
    const response=await page.goto(url,{waitUntil:"networkidle",timeout:45000});
    result.status=response?.status() ?? null;
    result.title=await page.title();
    await page.screenshot({path:path.join(out,name+".png"),fullPage:true});
    result.checks.httpOk=(result.status>=200 && result.status<400);
    result.checks.hasHeader=await page.locator("header").count()>0;
    result.checks.hasMessages=await page.locator(".messages").count()>0;
    result.checks.hasComposer=await page.locator(".composer").count()>0;
    result.checks.hasDrawer=await page.locator(".drawer").count()>0;
    result.checks.noMessageCards=await page.locator(".message").evaluateAll(es=>es.every(e=>{
      const s=getComputedStyle(e);
      return s.border==="0px none rgb(0, 0, 0)" || (parseFloat(s.borderWidth||"0")===0 && !s.className.includes("card"));
    }));
    result.ok=Object.values(result.checks).every(Boolean);
  }catch(e){ result.error=String(e); }
  return result;
}

const candidate=await inspect("http://127.0.0.1:4173/","candidate");
const live=await inspect(target,"live");
fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({candidate,live},null,2));

if(!candidate.ok) throw new Error("Candidate visual/structural inspection failed: "+JSON.stringify(candidate));
if(!live.ok) console.warn("Live inspection did not fully pass; report retained for review.");

await browser.close();
console.log(JSON.stringify({candidate,live},null,2));
