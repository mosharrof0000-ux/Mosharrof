export const API = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/personal-voice";
export const PROVIDER_KEY = "mosharrof_tts_provider_v1";
export const VOICE_KEY = "mosharrof_tts_voice_v1";
export const PACE_KEY = "mosharrof_tts_pace_v1";
const SUPABASE_URL = "https://jphortpnuddfsynqyock.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uq6UyghZx8NsSYQmL6gCTQ_2zBQZdKW";
const AUTH_STORAGE_KEY = "sb-jphortpnuddfsynqyock-auth-token";

export function element(documentRef, tag, text, className) {
  const node = documentRef.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function accessToken() {
  try {
    const auth = globalThis.MOSHARROF_AUTH || globalThis.mosharrofAuth;
    if (auth && typeof auth.getAccessToken === "function") {
      const token = await auth.getAccessToken();
      if (token) return token;
    }
  } catch {}
  try {
    const store = globalThis.localStorage;
    if (!store) return null;
    const raw = store.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const expiry = Number(session.expires_at || 0);
    if (session.access_token && (!expiry || expiry > Math.floor(Date.now() / 1000) + 30)) return session.access_token;
    if (!session.refresh_token) return null;
    const response = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
      cache: "no-store"
    });
    const next = await response.json().catch(() => ({}));
    if (!response.ok || !next.access_token) return null;
    const saved = { ...next, expires_at: Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600) };
    store.setItem(AUTH_STORAGE_KEY, JSON.stringify(saved));
    return saved.access_token;
  } catch { return null; }
}

export async function apiRequest(path, options = {}) {
  const token = await accessToken();
  if (!token) throw new Error("owner_login_required");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", "Bearer " + token);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(API + path, { ...options, headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "personal_voice_request_failed");
  return data;
}

export function statusText(error) {
  const value = String(error?.message || error);
  const messages = {
    owner_login_required: "Owner Login সেশন পাওয়া যায়নি",
    registered_owner_authentication_required: "Owner Login যাচাই প্রয়োজন",
    personal_voice_request_failed: "ভয়েস সার্ভার এখন প্রস্তুত নয়",
    personal_voice_inference_not_configured: "ক্লোন কণ্ঠের মডেল সার্ভার এখনো সংযুক্ত হয়নি"
  };
  return messages[value] || value.replaceAll("_", " ");
}

export async function signIn(email, password) {
  const response = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.msg || data.message || data.error_description || data.error || "login_failed");
  const saved = { ...data, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) };
  globalThis.localStorage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(saved));
}
