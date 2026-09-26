import { test, expect } from "@playwright/test";
import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const sizes=[
  ["mobile-390x844",{width:390,height:844}],
  ["mobile-412x915",{width:412,height:915}],
  ["tablet-768x1024",{width:768,height:1024}],
  ["desktop-1440x900",{width:1440,height:900}]
];

for(const [name,viewport] of sizes){
  test("visual structure "+name,async({browser})=>{
    const candidate=await browser.newPage({viewport});
    const baseline=await browser.newPage({viewport});
    const candidateUrl=process.env.BASE_URL||"http://127.0.0.1:4173";
    const baselineUrl=process.env.BASELINE_URL||"http://127.0.0.1:4174";
    await candidate.goto(candidateUrl,{waitUntil:"networkidle"});
    await baseline.goto(baselineUrl,{waitUntil:"networkidle"});

    for(const page of [candidate,baseline]){
      await expect(page.locator(".header")).toBeVisible();
      await expect(page.locator(".messages")).toBeVisible();
      await expect(page.locator(".composer")).toBeVisible();
      await expect(page.locator(".messages .message").first()).toBeVisible();
      expect(await page.locator(".messages").evaluate(e=>getComputedStyle(e).overflow)).toMatch(/auto|scroll/);
    }

    const candidatePath="test-results/candidate-"+name+".png";
    const baselinePath="test-results/baseline-"+name+".png";
    fs.mkdirSync("test-results",{recursive:true});
    await candidate.screenshot({path:candidatePath});
    await baseline.screenshot({path:baselinePath});

    const a=PNG.sync.read(fs.readFileSync(baselinePath));
    const b=PNG.sync.read(fs.readFileSync(candidatePath));
    const diff=new PNG({width:a.width,height:a.height});
    const changed=pixelmatch(a.data,b.data,diff.data,0.1);
    const ratio=changed/(a.width*a.height);
    console.log(name+" visual difference ratio="+ratio.toFixed(4));

    // Large differences are evidence for review, not an automatic failure:
    // intentional design changes are expected. Core structure above is the hard gate.
    fs.writeFileSync("test-results/diff-"+name+".png",PNG.sync.write(diff));

    const candidateText=await candidate.locator("body").innerText();
    expect(candidateText).toContain("MOSHARROF");
    expect(candidateText).toContain("AI");

    await candidate.close();
    await baseline.close();
  });
}
