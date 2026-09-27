import { chromium } from "playwright";
import fs from "node:fs";

const base=process.argv[2] || "http://127.0.0.1:4173";
fs.mkdirSync("artifacts/visual",{recursive:true});

const views=[
  {name:"desktop",width:1440,height:900,isMobile:false},
  {name:"mobile",width:390,height:844,isMobile:true}
];

let failed=false;
const browser=await chromium.launch({headless:true});

for(const view of views){
  const page=await browser.newPage({
    viewport:{width:view.width,height:view.height},
    deviceScaleFactor:view.isMobile?2:1,
    isMobile:view.isMobile
  });

  try{
    await page.goto(base,{waitUntil:"networkidle",timeout:60000});

    const checks=await page.evaluate(()=>{
      const composer=document.querySelector(".composer");
      return {
        title:document.title,
        header:!!document.querySelector(".header"),
        messages:!!document.querySelector(".messages"),
        composer:!!composer,
        drawer:!!document.querySelector(".drawer"),
        messageCount:document.querySelectorAll(".message").length,
        bodyOverflow:getComputedStyle(document.body).overflow,
        composerPosition:composer?getComputedStyle(composer).position:"missing",
        fadeTop:!!document.querySelector(".messages:before"),
        fadeBottom:!!document.querySelector(".messages:after")
      };
    });

    fs.writeFileSync(
      \`artifacts/visual/\${view.name}.json\`,
      JSON.stringify(checks,null,2)
    );

    await page.screenshot({path:\`artifacts/visual/\${view.name}.png\`,fullPage:false});
    await page.waitForTimeout(2000);
    await page.screenshot({path:\`artifacts/visual/\${view.name}-after-2s.png\`,fullPage:false});

    if(
      !checks.header ||
      !checks.messages ||
      !checks.composer ||
      !checks.drawer ||
      checks.messageCount < 1 ||
      checks.bodyOverflow !== "hidden" ||
      checks.composerPosition !== "absolute" ||
      !checks.fadeTop ||
      !checks.fadeBottom
    ) failed=true;
  }catch(error){
    fs.writeFileSync(
      \`artifacts/visual/\${view.name}-error.txt\`,
      String(error.stack || error)
    );
    failed=true;
  }finally{
    await page.close();
  }
}

await browser.close();
if(failed) process.exit(1);
