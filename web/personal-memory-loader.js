/* Load memory modules in order so the engine API exists before UI and fetch bridge. */
export async function initializePersonalMemory() {
  for (const path of ["./personal-memory-engine.js", "./personal-memory-ui.js", "./personal-memory-bridge.js"]) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = path;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Failed to load " + path));
      document.head.appendChild(script);
    });
  }
  return { ready: !!window.MosharrofMemoryEngine };
}
