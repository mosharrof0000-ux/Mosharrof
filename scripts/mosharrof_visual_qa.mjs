import { chromium } from 'playwright';
import fs from 'node:fs';

const url=process.argv[2]||'http://127.0.0.1:4173';
fs.mkdirSync('artifacts/visual',{recursive:true});

const browser=await chromium.launch({headless:true});
const views=[
 {name:'mobile',width:390,height:844},
 {name:'desktop',width:1440,height:900}
];

let failed=false;
for(const v of views){
 const page=await browser.newPage({viewport:{width:v.width,height:v.height},deviceScaleFactor:1});
 try{
  await page.goto(url,{waitUntil:'networkidle',timeout:60000});
  await page.screenshot({path:'artifacts/visual/'+v.name+'.png',fullPage:false});
  const result=await page.evaluate(()=>{
   const m=document.querySelector('.messages');
   const cs=m?getComputedStyle(m):null;
   return {
    title:document.title,
    header:!!document.querySelector('.header'),
    messages:!!m,
    composer:!!document.querySelector('.composer'),
    drawer:!!document.querySelector('.drawer'),
    floatingMessages:document.querySelectorAll('.message').length,
    overflow: getComputedStyle(document.body).overflow,
    before:cs?cs.getPropertyValue('content'):'missing',
    after:cs?cs.getPropertyValue('content'):'missing',
    safeTop:document.documentElement.style.getPropertyValue('--safe-top')
   };
  });
  fs.writeFileSync('artifacts/visual/'+v.name+'.json',JSON.stringify(result,null,2));
  if(!result.header||!result.messages||!result.composer||!result.drawer||result.floatingMessages<1||result.overflow!=='hidden') failed=true;
 }catch(e){
  fs.writeFileSync('artifacts/visual/'+v.name+'-error.txt',String(e.stack||e));
  failed=true;
 }finally{
  await page.close();
 }
}
await browser.close();
process.exit(failed?1:0);
