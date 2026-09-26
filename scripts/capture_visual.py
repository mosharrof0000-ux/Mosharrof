import sys
from playwright.sync_api import sync_playwright

url, out = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(
        viewport={"width":390,"height":844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    page.goto(url, wait_until="networkidle")
    page.screenshot(path=out, full_page=True)
    browser.close()
