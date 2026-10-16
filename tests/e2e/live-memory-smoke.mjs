import { chromium } from "playwright";

const baseURL = (process.env.LIVE_SITE_URL || "https://mosharrof0000-ux.github.io/Mosharrof/").replace(/\/$/, "") + "/";
const marker = "MOSHARROF_MEMORY_E2E_" + new Date().toISOString().replace(/[^0-9A-Z]/gi, "");
const timeout = Number(process.env.E2E_TIMEOUT_MS || 30000);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: "block" });
const page = await context.newPage();
page.setDefaultTimeout(timeout);

async function assertMemoryContains() {
  return page.evaluate(async (needle) => {
    const api = window.MosharrofPersonalMemory;
    if (!api || typeof api.search !== "function") {
      return { ok: false, reason: "memory-bridge-not-installed" };
    }
    try {
      const rows = await api.search(needle, 20);
      const match = Array.isArray(rows) && rows.some((row) => String(row.text || "").includes(needle));
      return { ok: Boolean(match), reason: match ? "found" : "message-not-found", count: Array.isArray(rows) ? rows.length : -1 };
    } catch (error) {
      return { ok: false, reason: "memory-search-failed", detail: String(error?.message || error) };
    }
  }, marker);
}

try {
  console.log("Opening live site:", baseURL);
  const response = await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log("HTTP status:", response?.status() ?? "no-main-document-response");
  if (response && !response.ok()) throw new Error("Live page returned HTTP " + response.status());

  await page.locator("#input").waitFor({ state: "visible", timeout: 45000 });
  await page.locator("#sendBtn").waitFor({ state: "visible" });
  await page.locator("#input").fill("Please remember this test marker: " + marker);
  await page.locator("#sendBtn").click();

  await page.waitForFunction((needle) => {
    const messages = document.querySelectorAll("#messages .message.user");
    return [...messages].some((node) => (node.innerText || node.textContent || "").includes(needle));
  }, marker, { timeout: 15000 });

  const beforeReload = await assertMemoryContains();
  if (!beforeReload.ok) {
    throw new Error("Memory save check failed before reload: " + JSON.stringify(beforeReload));
  }
  console.log("PASS: test message is searchable in local memory before reload.");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#input").waitFor({ state: "visible", timeout: 45000 });
  await page.waitForFunction(() => Boolean(window.MosharrofPersonalMemory?.search), null, { timeout: 20000 });
  const afterReload = await assertMemoryContains();
  if (!afterReload.ok) {
    throw new Error("Memory recall check failed after reload: " + JSON.stringify(afterReload));
  }
  console.log("PASS: test message remains searchable after reload.");
  console.log("RESULT=PASS marker=" + marker);
} catch (error) {
  console.error("RESULT=FAIL marker=" + marker);
  console.error(String(error?.stack || error));
  try {
    console.error("DIAGNOSTICS=" + JSON.stringify(await page.evaluate(() => ({
      title: document.title,
      url: location.href,
      inputPresent: Boolean(document.querySelector("#input")),
      sendButtonPresent: Boolean(document.querySelector("#sendBtn")),
      memoryBridgePresent: Boolean(window.MosharrofPersonalMemory),
      memoryBridgeInstalled: Boolean(window.__mosharrofMemoryBridgeInstalled),
      messages: (document.querySelector("#messages")?.innerText || "").slice(-1200)
    }))));
    await page.screenshot({ path: "live-memory-e2e-failure.png", fullPage: true }).catch(() => {});
  } catch {}
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
