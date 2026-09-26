import argparse, asyncio
from pathlib import Path
from playwright.async_api import async_playwright
p=argparse.ArgumentParser(); p.add_argument("--url",required=True); p.add_argument("--output",required=True); a=p.parse_args()
async def main():
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    async with async_playwright() as pw:
        browser=await pw.chromium.launch()
        page=await browser.new_page(viewport={"width":412,"height":915})
        await page.goto(a.url,wait_until="networkidle",timeout=60000)
        await page.screenshot(path=a.output,full_page=True)
        await browser.close()
asyncio.run(main())
