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
const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
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

// Candidate PR tests use a deterministic fake response. Live runs intentionally
// use the deployed Worker endpoint, exercising the actual chat request path.
const parsedBaseURL = new URL(baseURL);
const isCandidatePreview = ["127.0.0.1", "localhost"].includes(parsedBaseURL.hostname)
  && parsedBaseURL.port === "4173";
if (isCandidatePreview) {
  await page.route("**/chat", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, text: "Browser memory smoke test reply." })
    });
  });
}

page.on("console", message => {
  if (message.type() === "error") console.log("[browser console error]", message.text());
});
page.on("pageerror", error => console.log("[browser page error]", error.message));

try {
  console.log("Opening MOSHARROF site:", baseURL);
  const response = await page.goto(baseURL, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  if (!response || response.status() >= 400) {
    throw new Error("Site returned HTTP " + (response?.status() ?? "no response"));
  }
  await page.locator("#input").waitFor({ state: "visible" });
  await page.locator("#rightBtn").click();
  const controls = page.locator("[data-personal-memory-controls]");
  await controls.waitFor({ state: "visible" });

  const toggle = controls.locator("button").first();
  if ((await toggle.innerText()).includes("বন্ধ")) await toggle.click();
  if (!(await toggle.innerText()).includes("চালু")) {
    throw new Error("Could not enable personal memory from the chat UI");
  }
  // Close the drawer overlay before clicking the composer.
  await page.locator("#scrim").click({ position: { x: 5, y: 120 } });

  const marker = "MOSHARROF_MEMORY_SMOKE_" + Date.now();
  const message = "স্মৃতি ইঞ্জিনের স্বয়ংক্রিয় পরীক্ষা। এই শনাক্তকারীটি মনে রাখুন: " + marker;
  await page.locator("#input").fill(message);
  await page.locator("#sendBtn").click();

  // The bridge stores each user message locally before the chat request completes.
  await waitForStoredMarker(page, marker);
  console.log("PASS: test message was saved to IndexedDB:", marker);

  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.locator("#input").waitFor({ state: "visible" });
  await page.locator("#rightBtn").click();
  const reloadedControls = page.locator("[data-personal-memory-controls]");
  await reloadedControls.waitFor({ state: "visible" });
  const search = reloadedControls.locator('input[type="search"]');
  await search.fill(marker);
  await page.waitForFunction((needle) => {
    const controls = document.querySelector("[data-personal-memory-controls]");
    return Array.from(controls?.querySelectorAll(":scope > div") || [])
      .some(element => element.innerText.includes(needle));
  }, marker, { timeout: timeoutMs });
  const entriesAfterReload = await readMemoryEntries(page);
  if (!entriesAfterReload.some(row => JSON.stringify(row).includes(marker))) {
    throw new Error("Memory marker was not present after reload");
  }
  console.log("PASS: memory survived reload and is searchable in the UI");
  // The search drawer also overlays the composer after reload.
  await page.locator("#scrim").click({ position: { x: 5, y: 120 } });

  await page.locator("#input").fill("আমি কোন শনাক্তকারীটি মনে রাখতে বলেছিলাম?");
  const followUpRequestPromise = page.waitForRequest(request => {
    if (request.method() !== "POST") return false;
    try { return new URL(request.url()).pathname.endsWith("/chat"); }
    catch { return false; }
  }, { timeout: timeoutMs });
  await page.locator("#sendBtn").click();
  const followUpRequest = (await followUpRequestPromise).postDataJSON();
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

  if (!followUpRequest) throw new Error("Follow-up chat request was not observed");
  const diagnostic = await page.evaluate(async query => {
    const rows = await window.MosharrofPersonalMemory.recall(query, 16);
    const context = await window.MosharrofPersonalMemory.buildContext(query);
    return {
      rows: rows.map(row => ({
        kind: row.kind,
        text: String(row.text || "").slice(0, 500),
        score: row.score,
        overlap: row.overlap
      })),
      context: String(context || "").slice(0, 1600)
    };
  }, String(followUpRequest.text || ""));
  console.log("Follow-up text:", String(followUpRequest.text || ""));
  console.log("Direct recall diagnostics:", JSON.stringify(diagnostic)); 
  console.log("Follow-up payload keys:", JSON.stringify(Object.keys(followUpRequest)));
  console.log("Follow-up memory context:", String(followUpRequest.memory_context || "").slice(0, 1600));
  if (!String(followUpRequest.memory_context || "").includes(marker)) {
    throw new Error("Stored marker was not recalled into the follow-up request after reload");
  }
  console.log("PASS: follow-up request included the stored memory context after reload");
  console.log("RESULT: PASS");
} catch (error) {
  console.error("RESULT: FAIL", error?.stack || error);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
