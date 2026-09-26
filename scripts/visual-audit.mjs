import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const url=process.env.AUDIT_URL||'http://127.0.0.1:4173/';
const out=process.env.AUDIT_OUT||'visual-audit';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const pages=[
 {name:'mobile',width:390,height:844},
 {name:'desktop',width:1440,height:900}
];

async function aiReview(imagePath, viewName){
  const key=process.env.GEMINI_API_KEY;
  if(!key) return {status:'skipped',reason:'GEMINI_API_KEY not configured'};
  const bytes=await readFile(imagePath);
  const body={
    contents:[{parts:[
      {text:'Review this Mosharrof UI screenshot as a strict visual QA engineer. Check layout integrity, clipping, overlap, readability, fixed header/composer behavior, floating text, top/bottom fade, mobile/desktop usability, and whether existing UI appears accidentally removed. Return JSON only with status PASS or FAIL, issues array, and suggested_fixes array. Do not redesign unless something is broken.'},
      {inline_data:{mime_type:'image/png',data:bytes.toString('base64')}}
    ]}],
    generationConfig:{temperature:0.1,responseMimeType:'application/json'}
  };
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':key},
    body:JSON.stringify(body)
  });
  if(!response.ok) throw new Error('Gemini visual review HTTP '+response.status);
  const data=await response.json();
  return JSON.parse(data.candidates[0].content.parts[0].text);
}

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
  const review=await aiReview(shot,p.name);
  fs.writeFileSync(out+'/'+p.name+'-ai-review.json',JSON.stringify(review,null,2));
  if(review.status==='FAIL') failed=true;
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
