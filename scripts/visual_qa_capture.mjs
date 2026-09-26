import {chromium} from "playwright"; import fs from "fs";
const url=process.env.TARGET_URL;if(!url)throw Error("TARGET_URL required");
fs.mkdirSync("visual-qa",{recursive:true}); const b=await chromium.launch({headless:true});
for(const [name,width,height,mobile] of [["mobile",390,844,true],["desktop",1440,900,false]]){
 const p=await b.newPage({viewport:{width,height},deviceScaleFactor:mobile?2:1,isMobile:mobile});
 await p.goto(url,{waitUntil:"networkidle",timeout:60000}); await p.screenshot({path:"visual-qa/current-"+name+".png"});
 if(name==="mobile") fs.writeFileSync("visual-qa/layout.json",JSON.stringify(await p.evaluate(()=>({url:location.href,title:document.title,viewport:{w:innerWidth,h:innerHeight},horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,bodyOverflow:document.body.scrollWidth>innerWidth+2,selectors:Object.fromEntries(["header",".messages",".composer",".drawer",".quick"].map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return [s,r&&{x:r.x,y:r.y,w:r.width,h:r.height}]}))})),null,2));
 await p.close();
} await b.close();