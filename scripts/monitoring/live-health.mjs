export async function liveHealth(liveUrl) {
  const started = Date.now();
  try {
    const response = await fetch(liveUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "MOSHARROF-ReadOnly-Monitor/1.0" }
    });
    const html = await response.text();
    const hasBrand = /MOSHARROF AI/i.test(html);
    return {
      url: liveUrl, http_status: response.status, ok: response.ok && hasBrand,
      status: !response.ok ? "FAIL" : hasBrand ? "PASS_BASIC_HTTP_AND_BRAND" : "DEGRADED_BRAND_MARKER_MISSING",
      brand_marker_found: hasBrand, elapsed_ms: Date.now() - started,
      note: "HTTP and brand-marker smoke check only; not a functional chat, API-provider, or Android-device test."
    };
  } catch (error) {
    return {
      url: liveUrl, http_status: null, ok: false, status: "UNKNOWN_OR_UNREACHABLE",
      elapsed_ms: Date.now() - started, error: String(error),
      note: "A network failure from this runner does not alone prove the site is down."
    };
  }
}
