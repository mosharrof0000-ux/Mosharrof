const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

const candidate = process.argv[2];
const live = process.argv[3];
const out = 'visual-qa';
fs.mkdirSync(out,{recursive:true});

async function capture(url,name){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});
  let status=0;
  try{
    const response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});
    status=response ? response.status() : 0;
    await page.screenshot({path:path.join(out,name),fullPage:false});
  }finally{await browser.close();}
  return {status,errors};
}
const a=await capture(candidate,'candidate.png');
const b=await capture(live,'live.png');

let changed=0,total=0;
try{
  const p=PNG.sync.read(fs.readFileSync(path.join(out,'candidate.png')));
  const q=PNG.sync.read(fs.readFileSync(path.join(out,'live.png')));
  const w=Math.min(p.width,q.width),h=Math.min(p.height,q.height);
  const d=new PNG({width:w,height:h});
  changed=pixelmatch(
    p.data,q.data,d.data,w,h,{threshold:0.12}
  );
  total=w*h;
  fs.writeFileSync(path.join(out,'diff.png'),PNG.sync.write(d));
}catch(e){
  fs.writeFileSync(path.join(out,'diff-error.txt'),String(e));
}

fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({
  candidate:a,live:b,diff:{changed_pixels:changed,total_pixels:total,changed_ratio:total?changed/total:1}
},null,2));
