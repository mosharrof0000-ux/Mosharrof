import { chromium } from "playwright";
import fs from "node:fs";

const url = process.env.MOSHARROF_URL || "https://mosharrof0000-ux.github.io/Mosharrof/";
fs.mkdirSync("artifacts",{recursive:true});

const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});

const response = await page.goto(url,{waitUntil:"networkidle",timeout:60000});
if (!response || !response.ok()) throw new Error("Live URL did not return HTTP success.");

await page.screenshot({path:"artifacts/mosharrof-live.png",fullPage:true});

const result = await page.evaluate(() => ({
  title: document.title,
  width: document.documentElement.scrollWidth,
  height: document.documentElement.scrollHeight,
  bodyText: document.body.innerText.slice(0,4000),
  required: {
    header: !!document.querySelector(".header"),
    messages: !!document.querySelector(".messages"),
    composer: !!document.querySelector(".composer"),
    drawer: !!document.querySelector(".drawer"),
    floatingMessages: document.querySelectorAll(".message").length > 0
  }
}));

for (const [name, ok] of Object.entries(result.required)) {
  if (!ok) throw new Error("Visual/UI contract failed: "+name);
}

console.log(JSON.stringify(result,null,2));
await browser.close();
