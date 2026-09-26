/* Mosharrof Screenshot Analysis Worker
   POST JSON: { image_base64, mime_type, prompt? }
   Secret: GEMINI_API_KEY
*/
export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("POST only", { status: 405 });
    try {
      const body = await request.json();
      if (!body.image_base64 || !body.mime_type) {
        return Response.json({ error: "image_base64 and mime_type are required" }, { status: 400 });
      }
      if (!env.GEMINI_API_KEY) {
        return Response.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
      }
      const model = env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
      const prompt = body.prompt || "Analyze this screenshot in Bengali. Identify UI elements, layout, visible errors, text, spacing, colors, and actionable fixes. Separate observations from suggestions.";
      const upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: prompt },
              { inline_data: { mime_type: body.mime_type, data: body.image_base64 } }
            ] }]
          })
        }
      );
      const data = await upstream.json();
      if (!upstream.ok) return Response.json({ error: "Gemini request failed" }, { status: 502 });
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("\n") || "No analysis returned.";
      return Response.json({ ok: true, model, text });
    } catch {
      return Response.json({ error: "Invalid request or processing failure" }, { status: 400 });
    }
  }
};
