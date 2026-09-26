import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const url=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const out=process.env.AUDIT_OUT||'visual-audit';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const pages=[
 {name:'mobile',width:390,height:844},
 {name:'desktop',width:1440,height:900}
];
let failed=false;
for(const p of pages){
 const page=await browser.newPage({viewport:{width:p.width,height:p.height},deviceScaleFactor:1});
 await page.goto(url,{waitUntil:'networkidle',timeout:60000});
 const shot=out+'/'+p.name+'.png';
 await page.screenshot({path:shot,fullPage:false});
 const checks=await page.evaluate(()=>({
  title:document.title,
  hasHeader:!!document.querySelector('.header'),
  hasMessages:!!document.querySelector('.messages'),
  hasComposer:!!document.querySelector('.composer'),
  hasDrawer:!!document.querySelector('.drawer'),
  hasTopFade:!!document.querySelector('.messages'),
  hasBottomFade:!!document.querySelector('.messages'),
  bodyOverflow:getComputedStyle(document.body).overflow
 }));
 fs.writeFileSync(out+'/'+p.name+'.json',JSON.stringify(checks,null,2));
 if(!checks.hasHeader||!checks.hasMessages||!checks.hasComposer||!checks.hasDrawer||checks.bodyOverflow!=='hidden') failed=true;
 await page.close();
}
await browser.close();

if(process.env.BASELINE_DIR&&fs.existsSync(process.env.BASELINE_DIR)){
 for(const p of pages){
  const base=process.env.BASELINE_DIR+'/'+p.name+'.png';
  const current=out+'/'+p.name+'.png';
  const diff=out+'/'+p.name+'-diff.png';
  if(!fs.existsSync(base)) continue;
  try{execFileSync('node',['scripts/pixel-compare.mjs',base,current,diff],{stdio:'inherit'});}
  catch{failed=true;}
 }
}
process.exit(failed?1:0);
