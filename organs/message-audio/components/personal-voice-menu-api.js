export const API = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/personal-voice";
export const PROVIDER_KEY = "mosharrof_tts_provider_v1";
export const VOICE_KEY = "mosharrof_tts_voice_v1";
export const PACE_KEY = "mosharrof_tts_pace_v1";
const AUTH_STORAGE_KEY = "mosharrof_personal_voice_auth_v1";
let defaultProfileIdPromise = null;

export function element(documentRef, tag, text, className) {
  const node = documentRef.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function storedSession() {
  try {
    const store = globalThis.localStorage;
    const own = store?.getItem(AUTH_STORAGE_KEY);
    if (own) {
      const session = JSON.parse(own);
      if (session?.access_token) return { key: AUTH_STORAGE_KEY, session };
    }
    if (!store) return null;
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const session = JSON.parse(store.getItem(key) || "null");
      if (session?.access_token) return { key, session };
    }
  } catch {}
  return null;
}

export async function getAccessToken(fetcher = globalThis.fetch) {
  try {
    const auth = globalThis.MOSHARROF_AUTH || globalThis.mosharrofAuth;
    if (auth && typeof auth.getAccessToken === "function") {
      const token = await auth.getAccessToken();
      if (token) return token;
    }
  } catch {}
  try {
    const stored = storedSession();
    if (!stored) return null;
    const { key, session } = stored;
    const expiry = Number(session.expires_at || 0);
    if (session.access_token && (!expiry || expiry > Math.floor(Date.now() / 1000) + 30)) return session.access_token;
    if (!session.refresh_token) return null;
    const response = await fetcher(API + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
      cache: "no-store"
    });
    const next = await response.json().catch(() => ({}));
    if (!response.ok || !next.access_token) return null;
    const saved = { ...next, expires_at: Math.floor(Date.now() / 1000) + Number(next.expires_in || 3600) };
    globalThis.localStorage?.setItem(key, JSON.stringify(saved));
    return saved.access_token;
  } catch { return null; }
}

export async function apiRequest(path, options = {}, fetcher = globalThis.fetch, tokenProvider = null) {
  let token = null;
  try { if (typeof tokenProvider === "function") token = await tokenProvider(); } catch {}
  if (!token) token = await getAccessToken(fetcher);
  if (!token) throw new Error("owner_login_required");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", "Bearer " + token);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetcher(API + path, { ...options, headers, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "personal_voice_request_failed");
  return data;
}

export async function getDefaultVoiceProfileId(fetcher = globalThis.fetch, tokenProvider = null) {
  if (!defaultProfileIdPromise) {
    defaultProfileIdPromise = apiRequest("/profiles", {}, fetcher, tokenProvider)
      .then(data => data.default_profile_id || null)
      .catch(() => null);
  }
  return defaultProfileIdPromise;
}

export function cacheDefaultVoiceProfileId(profileId) {
  defaultProfileIdPromise = Promise.resolve(profileId || null);
}

export function resetDefaultVoiceProfileIdCache() {
  defaultProfileIdPromise = null;
}

export function statusText(error) {
  const value = String(error?.message || error);
  const messages = {
    owner_login_required: "লগইন সেশন পাওয়া যায়নি",
    registered_owner_authentication_required: "এই অ্যাকাউন্ট Owner Registry-তে অনুমোদিত নয়",
    personal_voice_request_failed: "ভয়েস সার্ভার এখন প্রস্তুত নয়",
    personal_voice_inference_not_configured: "ক্লোন কণ্ঠের মডেল সার্ভার এখনো সংযুক্ত হয়নি",
    personal_voice_enrollment_not_ready: "নিরাপদ ডেটাবেস, স্টোরেজ, এনক্রিপশন ও মডেল প্রস্তুত না হওয়া পর্যন্ত কণ্ঠ নিবন্ধন বন্ধ",
    email_not_confirmed: "ইমেইল যাচাই সম্পন্ন হয়নি",
    owner_login_invalid: "ইমেইল বা পাসওয়ার্ড সঠিক নয়",
    owner_login_unavailable: "Owner Login সার্ভার অনুপলব্ধ",
    supabase_auth_not_configured: "Owner Login সার্ভার কনফিগার করা নেই"
  };
  return messages[value] || value.replaceAll("_", " ");
}

export async function signIn(email, password) {
  const response = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new Error(data.error || "owner_login_invalid");
  const saved = { ...data, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) };
  globalThis.localStorage?.setItem(AUTH_STORAGE_KEY, JSON.stringify(saved));
  defaultProfileIdPromise = null;
}
