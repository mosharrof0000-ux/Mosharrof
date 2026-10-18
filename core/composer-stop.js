export function initializeComposerStopControl(send) {
  if (typeof window === "undefined" || !send || !send.parentNode) return;
  let stop = document.getElementById("stopBtn");
  if (!stop) {
    stop = document.createElement("button");
    stop.id = "stopBtn";
    stop.type = "button";
    stop.className = "composer-action mosharrof-stop-action";
    stop.disabled = true;
    stop.title = "চলমান মেসেজ থামান";
    stop.setAttribute("aria-label", stop.title);
    stop.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="currentColor"/></svg>';
    send.parentNode.insertBefore(stop, send);
  }
  if (!document.getElementById("mosharrof-stop-styles")) {
    const style = document.createElement("style");
    style.id = "mosharrof-stop-styles";
    style.textContent = ".mosharrof-stop-action{color:#f87171}.mosharrof-stop-action:disabled{display:none!important}";
    document.head.appendChild(style);
  }
  if (stop.dataset.stopBound === "true") return;
  stop.dataset.stopBound = "true";
  let activeController = null;
  const nativeFetch = window.fetch.bind(window);
  const finishStop = controller => {
    if (activeController === controller) activeController = null;
    stop.disabled = true;
  };
  if (!window.__mosharrofStopFetchPatched) {
    window.__mosharrofStopFetchPatched = true;
    window.fetch = function (resource, init) {
      const url = String(typeof resource === "string" ? resource : resource && resource.url || "");
      if (!url.includes("/chat")) return nativeFetch(resource, init);
      const controller = new AbortController();
      activeController = controller;
      stop.disabled = false;
      return nativeFetch(resource, { ...(init || {}), signal: controller.signal }).then(response => {
        if (!(response.headers.get("content-type") || "").toLowerCase().includes("text/event-stream") || !response.body) {
          finishStop(controller);
          return response;
        }
        const reader = response.body.getReader();
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(target) {
            function pump() {
              reader.read().then(part => {
                if (part.done) { target.close(); finishStop(controller); return; }
                target.enqueue(part.value);
                pump();
              }).catch(error => {
                if (controller.signal.aborted) {
                  target.enqueue(encoder.encode('data: {"type":"result","status":200,"data":{"text":"মেসেজ থামানো হয়েছে","provider":"MOSHARROF","model":"stopped","attempted":[]}}\n\n'));
                  target.close();
                } else target.error(error);
                finishStop(controller);
              });
            }
            pump();
          },
          cancel(reason) { controller.abort(); return reader.cancel(reason).catch(() => {}); }
        });
        return new Response(stream, { status: response.status, statusText: response.statusText, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" } });
      }).catch(error => {
        finishStop(controller);
        if (controller.signal.aborted) {
          return new Response(JSON.stringify({ text: "মেসেজ থামানো হয়েছে", provider: "MOSHARROF", model: "stopped", attempted: [] }), {
            status: 200, headers: { "Content-Type": "application/json" }
          });
        }
        throw error;
      });
    };
  }
  stop.addEventListener("click", () => {
    if (activeController) {
      stop.disabled = true;
      activeController.abort();
    }
  });
}
