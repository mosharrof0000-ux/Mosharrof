import { chromium } from "playwright";

const baseURL = process.env.MOSHARROF_TEST_URL || "https://deploy-preview-678--bucolic-mooncake-c83372.netlify.app/";
const timeoutMs = Number(process.env.MOSHARROF_TEST_TIMEOUT_MS || 45000);

async function readMemoryEntries(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("mosharrof-personal-memory-v1");
    request.onerror = () => reject(request.error || new Error("Could not open memory database"));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction("entries", "readonly");
      const read = tx.objectStore("entries").getAll();
      read.onsuccess = () => { const rows = read.result || []; db.close(); resolve(rows); };
      read.onerror = () => { const error = read.error; db.close(); reject(error); };
    };
  }));
}

async function waitForStoredMarker(page, marker) {
  await page.waitForFunction(async (needle) => {
    try {
      const req = indexedDB.open("mosharrof-personal-memory-v1");
      const db = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!db.objectStoreNames.contains("entries")) { db.close(); return false; }
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction("entries", "readonly");
        const get = tx.objectStore("entries").getAll();
        get.onsuccess = () => resolve(get.result || []);
        get.onerror = () => reject(get.error);
      });
      db.close();
      return rows.some(row => JSON.stringify(row).includes(needle));
    } catch { return false; }
  }, marker, { timeout: 20000 });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(timeoutMs);
page.on("console", message => {
  if (message.type() === "error") console.log("[browser console error]", message.text());
});
page.on("pageerror", error => console.log("[browser page error]", error.message));

try {
  console.log("Opening MOSHARROF preview:", baseURL);
  const response = await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  if (!response || response.status() >= 400) {
    throw new Error("Preview returned HTTP " + (response?.status() ?? "no response"));
  }
  await page.locator("#input").waitFor({ state: "visible" });
  await page.locator("#rightBtn").click();
  const controls = page.locator("[data-personal-memory-controls]");
  await controls.waitFor({ state: "visible" });

  const toggle = controls.locator("button").first();
  if ((await toggle.innerText()).includes("বন্ধ")) await toggle.click();
  if (!(await toggle.innerText()).includes("চালু")) {
    throw new Error("Could not enable personal memory from the live chat UI");
  }

  const marker = "MOSHARROF_MEMORY_SMOKE_" + Date.now();
  const message = "স্মৃতি ইঞ্জিনের স্বয়ংক্রিয় পরীক্ষা। এই শনাক্তকারীটি মনে রাখুন: " + marker;
  await page.locator("#input").fill(message);
  await page.locator("#sendBtn").click();

  // The bridge stores the user message locally before the chat request completes.
  await waitForStoredMarker(page, marker);
  console.log("PASS: message was written to IndexedDB:", marker);

  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.locator("#input").waitFor({ state: "visible" });
  await page.locator("#rightBtn").click();
  const reloadedControls = page.locator("[data-personal-memory-controls]");
  await reloadedControls.waitFor({ state: "visible" });
  const search = reloadedControls.locator('input[type="search"]');
  await search.fill(marker);
  await page.getByText(new RegExp(marker)).waitFor({ state: "visible", timeout: timeoutMs });
  const entriesAfterReload = await readMemoryEntries(page);
  if (!entriesAfterReload.some(row => JSON.stringify(row).includes(marker))) {
    throw new Error("Memory marker was not present after reload");
  }
  console.log("PASS: memory survived reload and is searchable in the UI");
  console.log("RESULT: PASS");
} catch (error) {
  console.error("RESULT: FAIL", error?.stack || error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
