const { test, expect } = require("@playwright/test");
const pixelmatch = require("pixelmatch");
const { PNG } = require("pngjs");
const fs = require("fs");
const candidate=process.env.BASE_URL||"http://127.0.0.1:4173";
const baseline=process.env.BASELINE_URL||"http://127.0.0.1:4174";
test("Mosharrof rendered design regression",async({browser})=>{
 const c=await browser.newPage(); const b=await browser.newPage();
 await c.goto(candidate,{waitUntil:"networkidle"}); await b.goto(baseline,{waitUntil:"networkidle"});
 await expect(c).toHaveTitle(/MOSHARROF AI/i); await expect(c.locator(".header")).toBeVisible(); await expect(c.locator("#messages")).toBeVisible(); await expect(c.locator(".composer")).toBeVisible();
 const overflow=await c.evaluate(()=>({w:document.documentElement.clientWidth,s:document.documentElement.scrollWidth})); expect(overflow.s).toBeLessThanOrEqual(overflow.w+2);
 const [cb,bb]=await Promise.all([c.screenshot({fullPage:true,animations:"disabled"}),b.screenshot({fullPage:true,animations:"disabled"})]);
 const ca=PNG.sync.read(cb), ba=PNG.sync.read(bb); expect(ca.width).toBe(ba.width); expect(ca.height).toBe(ba.height);
 const diff=new PNG({width:ca.width,height:ca.height}); const pixels=pixelmatch(ba.data,ca.data,diff.data,ca.width,ca.height,{threshold:0.12,includeAA:false}); const ratio=pixels/(ca.width*ca.height);
 fs.mkdirSync("test-results",{recursive:true}); fs.writeFileSync("test-results/candidate.png",PNG.sync.write(ca)); fs.writeFileSync("test-results/baseline.png",PNG.sync.write(ba)); fs.writeFileSync("test-results/diff.png",PNG.sync.write(diff));
 expect(ratio).toBeLessThanOrEqual(0.035); await c.close(); await b.close();
});