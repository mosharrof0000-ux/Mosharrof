const MAX_OUTPUT_BYTES = 20 * 1024 * 1024;

export function getIndicF5Capabilities() {
  return Object.freeze({
    provider_id: "indicf5",
    reference_audio: true,
    reference_transcript: true,
    model_training: false,
    controls: Object.freeze({
      speed: false, pitch: false, emotion: false, intensity: false, pause: false, emphasis: false
    })
  });
}

export function createIndicF5Request({ text, referenceText, audioBytes, mimeType }) {
  const spokenText = String(text || "").trim();
  const transcript = String(referenceText || "").trim();
  const type = String(mimeType || "").toLowerCase();
  if (!spokenText || spokenText.length > 800) throw new Error("indicf5_text_limit");
  if (!transcript || transcript.length > 500) throw new Error("indicf5_reference_text_limit");
  if (!(audioBytes instanceof Uint8Array) || !audioBytes.length || audioBytes.length > 5 * 1024 * 1024) throw new Error("indicf5_reference_audio_limit");
  if (!["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave", "audio/flac", "audio/ogg"].includes(type)) throw new Error("indicf5_reference_audio_type");
  const form = new FormData();
  form.append("text", spokenText);
  form.append("reference_text", transcript);
  form.append("reference_audio", new Blob([audioBytes], { type }), "reference-audio");
  return form;
}

export async function synthesizeWithIndicF5({ endpoint, token, formData, fetchImpl = fetch }) {
  let base;
  try {
    base = new URL(String(endpoint || ""));
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("invalid_url");
  } catch { throw new Error("indicf5_endpoint_not_configured"); }
  const bearer = String(token || "").trim();
  if (bearer.length < 32) throw new Error("indicf5_token_not_configured");
  const response = await fetchImpl(new URL("/synthesize", base), {
    method: "POST",
    headers: { authorization: "Bearer " + bearer },
    body: formData,
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error("indicf5_inference_failed:" + response.status);
  const audio = new Uint8Array(await response.arrayBuffer());
  if (!audio.length || audio.byteLength > MAX_OUTPUT_BYTES) throw new Error("indicf5_invalid_audio_response");
  return Object.freeze({ audio, mimeType: "audio/wav" });
}
