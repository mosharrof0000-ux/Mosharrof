import { baseUrl, json, publishableKey } from "./shared.js";

async function authExchange(request, env, grant) {
  const base = baseUrl(env);
  const key = publishableKey(env);
  if (!base || !key) return json({ error: "supabase_auth_not_configured" }, 503);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 8192) return json({ error: "auth_request_too_large" }, 413);
  const body = await request.json().catch(() => null);
  let payload;
  if (grant === "password") {
    const email = String(body?.email || "").trim();
    const password = String(body?.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 256) {
      return json({ error: "valid_owner_credentials_required" }, 400);
    }
    payload = { email, password };
  } else {
    const refresh_token = String(body?.refresh_token || "");
    if (refresh_token.length < 20 || refresh_token.length > 8192) return json({ error: "valid_refresh_token_required" }, 400);
    payload = { refresh_token };
  }
  try {
    const response = await fetch(new URL("/auth/v1/token?grant_type=" + grant, base), {
      method: "POST",
      headers: { apikey: key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      const code = String(data.error_code || data.code || data.error || "");
      if (code === "email_not_confirmed") return json({ error: "email_not_confirmed" }, 403);
      if (response.status === 400 || response.status === 401) return json({ error: "owner_login_invalid" }, 401);
      return json({ error: "owner_login_unavailable" }, 502);
    }
    return json(data, 200);
  } catch {
    return json({ error: "owner_login_unavailable" }, 502);
  }
}

export async function handlePersonalVoiceAuth(request, env) {
  const path = new URL(request.url).pathname;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (path === "/personal-voice/auth/login") return authExchange(request, env, "password");
  if (path === "/personal-voice/auth/refresh") return authExchange(request, env, "refresh_token");
  return null;
}
