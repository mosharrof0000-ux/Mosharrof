import { chromium } from "playwright";

const target = process.argv[2];
if (!target || !/^https:\/\//i.test(target)) {
  throw new Error("Pass an HTTPS target URL, for example the live Pages URL or a PR preview URL.");
}

const marker = "MOSHARROF_MEMORY_SMOKE_" + new Date().toISOString().replace(/[^0-9]/g, "");
const testMessage = marker + " — remember this browser memory test.";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(15000);

try {
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.MosharrofPersonalMemory), null, { timeout: 30000 });

  // Open the options drawer and enable local memory for this isolated test browser.
  const rightButton = page.locator("#rightBtn");
  if (await rightButton.count()) await rightButton.click();
  const memoryControls = page.locator("[data-personal-memory-controls]");
  await memoryControls.waitFor({ state: "attached", timeout: 15000 });
  const toggle = memoryControls.locator("button").first();
  const toggleText = (await toggle.innerText()).trim();
  if (toggleText.includes("বন্ধ")) await toggle.click();
  await page.waitForFunction(() => window.MosharrofPersonalMemory?.enabled?.() === true);

  await page.locator("#input").fill(testMessage);
  await page.locator("#sendBtn").click();

  // The bridge saves the user's message locally before awaiting the chat response.
  await page.waitForFunction(async (expected) => {
    const request = indexedDB.open("mosharrof-personal-memory-v1", 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => resolve(request.result);
    });
    if (!db.objectStoreNames.contains("entries")) return false;
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction("entries", "readonly");
      const get = tx.objectStore("entries").getAll();
      get.onsuccess = () => resolve(get.result || []);
      get.onerror = () => reject(get.error);
    });
    db.close();
    return rows.some((row) => row.kind === "user" && row.text === expected);
  }, testMessage, { timeout: 20000 });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.MosharrofPersonalMemory), null, { timeout: 30000 });

  const persisted = await page.evaluate(async (expected) => {
    const request = indexedDB.open("mosharrof-personal-memory-v1", 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => resolve(request.result);
    });
    if (!db.objectStoreNames.contains("entries")) return false;
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction("entries", "readonly");
      const get = tx.objectStore("entries").getAll();
      get.onsuccess = () => resolve(get.result || []);
      get.onerror = () => reject(get.error);
    });
    db.close();
    return rows.some((row) => row.kind === "user" && row.text === expected);
  }, testMessage);

  if (!persisted) throw new Error("Message was stored before refresh but could not be found after refresh.");
  console.log(JSON.stringify({ result: "PASS", target, marker, checks: ["bridge loaded", "memory enabled", "message stored", "message persisted after refresh"] }, null, 2));
} catch (error) {
  await page.screenshot({ path: "live-memory-smoke-failure.png", fullPage: true }).catch(() => {});
  console.error("LIVE MEMORY SMOKE FAILED:", error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
