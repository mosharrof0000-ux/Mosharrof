import { chromium } from "playwright";

const baseURL = process.env.MOSHARROF_TEST_URL || "http://127.0.0.1:4173/";
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

async function openMemoryControls(page) {
  const controls = page.locator("[data-personal-memory-controls]");
  if (!(await controls.isVisible().catch(() => false))) {
    await page.locator("#rightBtn").click();
  }
  await controls.waitFor({ state: "visible" });
  return controls;
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
const chatRequests = [];
page.on("request", request => {
  if (request.method() !== "POST") return;
  try {
    if (new URL(request.url()).pathname.endsWith("/chat")) {
      chatRequests.push(request.postDataJSON() || {});
    }
  } catch {}
});

// Candidate and post-deploy checks mock chat calls to avoid quota use. A manual
// live run sends one synthetic message to the real Worker; the follow-up is mocked.
const parsedBaseURL = new URL(baseURL);
const isCandidatePreview = ["127.0.0.1", "localhost"].includes(parsedBaseURL.hostname)
  && parsedBaseURL.port === "4173";
const useMockChat = process.env.MOSHARROF_MOCK_CHAT !== "0" || isCandidatePreview;
let livePostCount = 0;
await page.route("**/chat", async route => {
  const method = route.request().method();
  if (method === "OPTIONS") {
    if (useMockChat) {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type"
        }
      });
    } else {
      await route.continue();
    }
    return;
  }
  let payload = {};
  try { payload = route.request().postDataJSON() || {}; } catch {}
  if (!useMockChat && livePostCount++ === 0) {
    await route.continue();
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ ok: true, text: "Browser memory smoke test reply." })
  });
});
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
  const controls = await openMemoryControls(page);

  const toggle = controls.locator("button").first();
  if ((await toggle.innerText()).includes("বন্ধ")) await toggle.click();
  if (!(await toggle.innerText()).includes("চালু")) {
    throw new Error("Could not enable personal memory from the live chat UI");
  }
  const marker = "MOSHARROF_MEMORY_SMOKE_" + Date.now();
  const message = "স্মৃতি ইঞ্জিনের স্বয়ংক্রিয় পরীক্ষা। এই শনাক্তকারীটি মনে রাখুন: " + marker;
  await page.locator("#input").fill(message);
  const firstChatResponse = page.waitForResponse(response =>
    response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/chat"),
    { timeout: timeoutMs }
  );
  await page.locator("#sendBtn").click();

  // The bridge stores the user message locally before the chat request completes.
  await waitForStoredMarker(page, marker);
  const chatResponse = await firstChatResponse;
  console.log("PASS: message was written to IndexedDB:", marker, "chat HTTP", chatResponse.status());

  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.locator("#input").waitFor({ state: "visible" });
  const reloadedControls = await openMemoryControls(page);
  const search = reloadedControls.locator('input[type="search"]');
  await search.fill(marker);
  await page.waitForFunction((needle) => {
    const controls = document.querySelector("[data-personal-memory-controls]");
    return Boolean(controls && [...controls.querySelectorAll("div")].some(
      node => (node.innerText || node.textContent || "").includes(needle)
    ));
  }, marker, { timeout: timeoutMs });
  const entriesAfterReload = await readMemoryEntries(page);
  if (!entriesAfterReload.some(row => JSON.stringify(row).includes(marker))) {
    throw new Error("Memory marker was not present after reload");
  }
  console.log("PASS: memory survived reload and is searchable in the UI");
  // Check retrieval separately from request wiring so failures identify the broken layer.
  const followUpText = "আমি কোন শনাক্তকারীটি মনে রাখতে বলেছিলাম?";
  const contextPreview = await page.evaluate(query => window.MosharrofPersonalMemory.buildContext(query), followUpText);
  console.log("Memory context retrieval diagnostic:", JSON.stringify({hasMarker: contextPreview.includes(marker), length: contextPreview.length}));
  // Send a follow-up after reload and wait for its network request before inspecting it.
  await page.locator("#input").fill(followUpText);
  const followUpResponse = page.waitForResponse(response =>
    response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/chat"),
    { timeout: timeoutMs }
  );
  await page.locator("#sendBtn").click();
  await page.waitForFunction(async () => {
    const request = indexedDB.open("mosharrof-personal-memory-v1");
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!db.objectStoreNames.contains("entries")) { db.close(); return false; }
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction("entries", "readonly");
      const get = tx.objectStore("entries").getAll();
      get.onsuccess = () => resolve(get.result || []);
      get.onerror = () => reject(get.error);
    });
    db.close();
    return rows.some(row => row.kind === "user" && row.text.includes("শনাক্তকারীটি মনে রাখতে"));
  }, null, { timeout: 20000 });
  await followUpResponse;

  const followUpRequest = chatRequests.at(-1);
  if (!followUpRequest) throw new Error("Follow-up chat request was not intercepted");
  if (!String(followUpRequest.memory_context || "").includes(marker)) {
    throw new Error("Stored marker was not recalled into the follow-up request after reload");
  }
  console.log("PASS: follow-up request received the stored memory context after reload");
  console.log("RESULT: PASS");
} catch (error) {
  console.error("RESULT: FAIL", error?.stack || error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
