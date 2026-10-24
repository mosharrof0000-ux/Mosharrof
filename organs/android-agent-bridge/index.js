const PAIRING_KEY = "mosharrof_android_agent_pairing_secret_v1";
const CALLBACK_RESULT_KEY = "mosharrof_android_result";

function cleanCommand(value) {
  return String(value || "").trim().replace(/[।.!?]+$/g, "").replace(/\s+/g, " ");
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, byte => byte.toString(16).padStart(2, "0")).join("");
}

function decodePairingSecret(value) {
  try {
    const normalized = String(value || "").trim();
    if (!/^[A-Za-z0-9+/]{43}=$/.test(normalized)) return null;
    const bytes = Uint8Array.from(atob(normalized), ch => ch.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch (_) {
    return null;
  }
}

function classifyCommand(raw) {
  const command = cleanCommand(raw);
  if (/^(?:android|phone|ফোন|অ্যান্ড্রয়েড)\s*(?:যুক্ত করুন|জুড়ুন|pair|connect)|^(?:pair|connect|link)\s*(?:android|phone)?$/i.test(command)) {
    return { type: "pair" };
  }
  if (/^(?:disconnect|unpair)\s*(?:android|phone)?$|^(?:অ্যান্ড্রয়েড|ফোন)\s*(?:বিচ্ছিন্ন|আনপেয়ার)\s*করুন$/i.test(command)) {
    return { type: "unpair" };
  }
  if (/^(?:install\s+apk|install\s+app|অ্যাপ\s+ইনস্টল\s+করুন|apk\s+ইনস্টল\s+করুন|ইনস্টল\s+করুন)$/i.test(command)) {
    return { type: "command", action: "INSTALL_APK", target: "" };
  }
  const uninstall = command.match(/^(?:uninstall|remove app|আনইনস্টল করুন|অ্যাপ আনইনস্টল করুন)\s+(.+)$/i);
  if (uninstall) {
    const target = uninstall[1].trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(target)) {
      return { type: "invalid", reply: "নিরাপত্তার জন্য ওয়েব থেকে আনইনস্টল করতে অ্যাপের package ID দিন (যেমন com.example.app)। অ্যাপের নাম দিয়ে স্থানীয় Android Agent-এ লক্ষ্যটি যাচাই করুন।" };
    }
    return { type: "command", action: "UNINSTALL_APP", target };
  }
  const install = command.match(/^(?:install|install app|অ্যাপ ইনস্টল)\s+(.+)$/i);
  if (install) {
    const target = install[1].trim();
    if (!target || target.length > 120 || /[\u0000-\u001f]/.test(target)) {
      return { type: "invalid", reply: "অ্যাপের সার্চ নামটি খালি বা সমর্থিত সীমার বাইরে।" };
    }
    return { type: "command", action: "SEARCH_PLAY_STORE", target };
  }
  return null;
}

async function signEnvelope(secretBytes, fields) {
  if (!globalThis.crypto?.subtle) throw new Error("এই ব্রাউজারে নিরাপদ command signing সমর্থিত নয়।");
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const canonical = [
    "mosharrof-device-command-v1",
    fields.requestId,
    fields.action,
    String(fields.issuedAt),
    String(fields.expiresAt),
    fields.nonce,
    fields.target
  ].join("\n");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  return bytesToHex(signature);
}

/** Returns null for ordinary chat, or a handled response/launch request for package commands. */
export async function tryAndroidAgentCommand(raw) {
  const parsed = classifyCommand(raw);
  if (!parsed) return null;

  if (parsed.type === "pair") {
    const value = window.prompt("Android Agent অ্যাপে ‘Mosharrof Web-এর সঙ্গে যুক্ত করুন’ চাপুন, pairing key কপি করুন, তারপর এখানে পেস্ট করুন:");
    if (value === null) return { handled: true, reply: "Android pairing বাতিল করা হয়েছে।" };
    const secret = decodePairingSecret(value);
    if (!secret) return { handled: true, reply: "Pairing key গ্রহণ করা যায়নি। Android Agent থেকে কপি করা সম্পূর্ণ ৩২-বাইট key পেস্ট করুন।" };
    localStorage.setItem(PAIRING_KEY, value.trim());
    return { handled: true, reply: "Android Agent-এর pairing key এই ব্রাউজারে সংরক্ষিত হয়েছে। এখন ‘install apk’, ‘install অ্যাপের নাম’, অথবা ‘uninstall com.example.app’ লিখে পাঠাতে পারেন। সংবেদনশীল/শেয়ার করা ব্রাউজারে key সংরক্ষণ করবেন না।" };
  }

  if (parsed.type === "unpair") {
    localStorage.removeItem(PAIRING_KEY);
    return { handled: true, reply: "এই ব্রাউজারের Android pairing key মুছে ফেলা হয়েছে। Android Agent-এ নতুন key তৈরি করলে পুরোনো সংযোগও অকার্যকর হবে।" };
  }

  if (parsed.type === "invalid") return { handled: true, reply: parsed.reply };

  const secret = decodePairingSecret(localStorage.getItem(PAIRING_KEY));
  if (!secret) {
    return { handled: true, reply: "Android Agent এখনো এই ব্রাউজারের সঙ্গে যুক্ত নয়। আগে Android Agent অ্যাপে pairing key তৈরি/কপি করুন, তারপর ‘Android যুক্ত করুন’ লিখুন।" };
  }

  try {
    const now = Date.now();
    const fields = {
      requestId: randomToken(16),
      action: parsed.action,
      issuedAt: now,
      expiresAt: now + 60_000,
      nonce: randomToken(24),
      target: parsed.target
    };
    const signature = await signEnvelope(secret, fields);
    const callback = new URL(window.location.pathname, window.location.origin).toString();
    const uri = new URL("mosharrof-agent://command");
    uri.searchParams.set("rid", fields.requestId);
    uri.searchParams.set("action", fields.action);
    uri.searchParams.set("issued", String(fields.issuedAt));
    uri.searchParams.set("expires", String(fields.expiresAt));
    uri.searchParams.set("nonce", fields.nonce);
    uri.searchParams.set("target", fields.target);
    uri.searchParams.set("sig", signature);
    uri.searchParams.set("callback", callback);
    return {
      handled: true,
      reply: parsed.action === "UNINSTALL_APP"
        ? "স্বাক্ষরিত আনইনস্টল অনুরোধ Android Agent-এ পাঠানো হচ্ছে। ফোনে Android-এর নিজস্ব নিশ্চিতকরণ লাগবে; ফল যাচাই না হওয়া পর্যন্ত সফল বলা হবে না।"
        : parsed.action === "INSTALL_APK"
          ? "স্বাক্ষরিত APK ইনস্টল অনুরোধ Android Agent-এ পাঠানো হচ্ছে। APK বেছে নিয়ে Android-এর নিশ্চিতকরণ সম্পন্ন করুন।"
          : "স্বাক্ষরিত Play Store সার্চ অনুরোধ Android Agent-এ পাঠানো হচ্ছে। Play Store খোলা মানেই ইনস্টল সফল নয়।",
      launchUrl: uri.toString()
    };
  } catch (error) {
    return { handled: true, reply: String(error?.message || "নিরাপদ Android command তৈরি করা যায়নি।") };
  }
}

/** Read a verified local-agent callback from the URL once and remove it to prevent repeats. */
export async function consumeAndroidBridgeResult() {
  const url = new URL(window.location.href);
  if (url.searchParams.get(CALLBACK_RESULT_KEY) !== "1") return null;
  const result = {
    requestId: url.searchParams.get("request_id") || "unknown",
    action: url.searchParams.get("action") || "UNKNOWN",
    status: url.searchParams.get("status") || "UNKNOWN",
    detail: url.searchParams.get("detail") || "Android Agent ফল ফেরত দিয়েছে।",
    verified: url.searchParams.get("verified") === "true",
    packageName: url.searchParams.get("package") || "",
    signature: url.searchParams.get("callback_sig") || ""
  };
  for (const key of [CALLBACK_RESULT_KEY, "request_id", "action", "status", "detail", "verified", "package", "callback_sig"]) {
    url.searchParams.delete(key);
  }
  history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);

  try {
    const secret = decodePairingSecret(localStorage.getItem(PAIRING_KEY));
    if (!secret || !result.signature || !crypto?.subtle) throw new Error("signature unavailable");
    const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const canonical = [
      "mosharrof-device-result-v1",
      result.requestId,
      result.action,
      result.status,
      result.packageName,
      String(result.verified),
      result.detail
    ].join("\n");
    const signatureBytes = Uint8Array.from(result.signature.match(/.{2}/g) || [], part => parseInt(part, 16));
    const valid = /^[0-9a-f]{64}$/i.test(result.signature) &&
      await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(canonical));
    if (!valid) throw new Error("signature invalid");
    result.callbackSignatureValid = true;
  } catch (_) {
    result.callbackSignatureValid = false;
    result.verified = false;
    result.detail = "ফলাফলের স্বাক্ষর যাচাই হয়নি; এই callback-কে প্রমাণ হিসেবে গ্রহণ করবেন না।";
  }
  delete result.signature;
  return result;
}


function renderBridgeMessage(role, text) {
  const messages = document.querySelector("#messages");
  if (!messages) return;
  const node = document.createElement("div");
  node.className = "message " + role;
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = role === "user" ? "আপনি" : "MOSHARROF AI · Android Agent";
  node.appendChild(label);
  node.appendChild(document.createTextNode(String(text || "")));
  messages.appendChild(node);
  const scroll = document.querySelector("#chatScroll");
  if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

async function interceptPackageCommand(event) {
  const input = document.querySelector("#input");
  if (!input) return;
  if (event.type === "click") {
    if (!event.target.closest || !event.target.closest("#sendBtn")) return;
  } else {
    if (event.target !== input || event.key !== "Enter" || event.shiftKey) return;
  }
  const raw = input.value.trim();
  if (!raw || !classifyCommand(raw)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  const button = document.querySelector("#sendBtn");
  if (button) button.disabled = true;
  renderBridgeMessage("user", raw);
  input.value = "";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  try {
    const result = await tryAndroidAgentCommand(raw);
    if (result && result.handled) {
      renderBridgeMessage("ai", result.reply);
      if (result.launchUrl) setTimeout(() => { window.location.href = result.launchUrl; }, 80);
    } else {
      renderBridgeMessage("ai", "Android commandটি যাচাই করা যায়নি; কোনো কাজ চালানো হয়নি।");
    }
  } catch (error) {
    renderBridgeMessage("ai", String(error && error.message || "Android command ব্যর্থ হয়েছে।"));
  } finally {
    if (button) button.disabled = false;
    input.focus();
  }
}

/** Install only capture-phase interceptors; ordinary chat continues to its existing handler. */
export function initialize() {
  if (window.__mosharrofAndroidAgentBridgeReady) return;
  window.__mosharrofAndroidAgentBridgeReady = true;
  document.addEventListener("click", interceptPackageCommand, true);
  document.addEventListener("keydown", interceptPackageCommand, true);
  consumeAndroidBridgeResult().then(result => {
    if (!result) return;
    const label = result.callbackSignatureValid && result.verified
      ? "স্বাক্ষর ও প্যাকেজ যাচাইকৃত"
      : "যাচাইকৃত নয়";
    renderBridgeMessage(
      "ai",
      `Android Agent ফল: ${result.status} · ${label}\n${result.detail}\nRequest ID: ${result.requestId}`
    );
  }).catch(() => {});
}
