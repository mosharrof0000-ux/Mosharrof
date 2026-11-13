import { PACE_KEY, PROVIDER_KEY, VOICE_KEY, element, statusText } from "./personal-voice-menu-api.js";
import { mountPersonalVoiceProfiles } from "./personal-voice-menu-profiles.js";
import { mountVoiceCatalog } from "./personal-voice-menu-catalog.js";
import { getProviderControlCapabilities } from "../../personal-voice/index.js";

export function createPersonalVoiceMenu({ button, message, controller, documentRef = globalThis.document, storage = globalThis.localStorage } = {}) {
  if (!button || !documentRef || !controller) return () => {};
  let panel = null;
  let holdTimer = null;
  let status = null;
  let catalogManager = null;

  function close() {
    if (catalogManager) catalogManager.dispose();
    catalogManager = null;
    if (panel) panel.remove();
    panel = null;
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function action(label, onClick, className = "") {
    const item = element(documentRef, "button", label, "pv-action " + className);
    item.type = "button";
    item.addEventListener("click", async () => {
      item.disabled = true;
      try { await onClick(); }
      catch (error) { setStatus(statusText(error)); }
      finally { item.disabled = false; }
    });
    return item;
  }

  async function open() {
    close();
    panel = element(documentRef, "section", undefined, "personal-voice-menu");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "পড়ে শোনানোর সেটিংস");
    panel.addEventListener("pointerdown", event => event.stopPropagation());
    const heading = element(documentRef, "div", undefined, "pv-heading");
    heading.append(element(documentRef, "strong", "পড়ে শোনান"), action("বন্ধ", close, "pv-close"));
    panel.appendChild(heading);

    const providerLabel = element(documentRef, "label", "TTS সার্ভার", "pv-label");
    const provider = element(documentRef, "select", undefined, "pv-select");
    for (const [value, label] of [["auto","Auto"],["edge","Edge-TTS"],["gemini","Gemini"],["azure","Azure"],["elevenlabs","ElevenLabs"],["sarvam","Sarvam"],["browser","Browser Voice"]]) {
      const option = element(documentRef, "option", label);
      option.value = value;
      provider.appendChild(option);
    }
    try { provider.value = storage?.getItem(PROVIDER_KEY) || "auto"; } catch {}
    provider.addEventListener("change", () => {
      try { storage?.setItem(PROVIDER_KEY, provider.value); } catch {}
      refreshProviderControls();
    });
    providerLabel.appendChild(provider);
    panel.appendChild(providerLabel);

    const speedLabel = element(documentRef, "label", "গতি", "pv-label");
    const speed = element(documentRef, "input");
    speed.type = "range"; speed.min = "0.75"; speed.max = "1.25"; speed.step = "0.05"; speed.className = "pv-speed";
    try { speed.value = storage?.getItem(PACE_KEY) || "1"; } catch { speed.value = "1"; }
    const speedValue = element(documentRef, "span", speed.value + "×", "pv-muted");
    speed.addEventListener("input", () => {
      speedValue.textContent = Number(speed.value).toFixed(2).replace(/0$/, "") + "×";
      try { storage?.setItem(PACE_KEY, speed.value); } catch {}
    });
    speedLabel.append(speed, speedValue);
    panel.appendChild(speedLabel);

    const voiceLabel = element(documentRef, "label", "বাংলা সার্ভার ভয়েস", "pv-label");
    const voice = element(documentRef, "select", undefined, "pv-select");
    for (const [value, label] of [["bn-BD-PradeepNeural","Pradeep · পুরুষ"],["bn-BD-NabanitaNeural","Nabanita · নারী"]]) {
      const option = element(documentRef, "option", label);
      option.value = value;
      voice.appendChild(option);
    }
    try { voice.value = storage?.getItem(VOICE_KEY) || "bn-BD-PradeepNeural"; } catch {}
    voice.addEventListener("change", () => { try { storage?.setItem(VOICE_KEY, voice.value); } catch {} });
    voiceLabel.appendChild(voice);
    panel.appendChild(voiceLabel);

    function refreshProviderControls() {
      const personalSelected = button.dataset.voiceProfileDisabled !== "true" && (!!button.dataset.voiceProfileId || button.dataset.voiceProfileDefaultActive === "true");
      provider.disabled = personalSelected;
      const supported = !personalSelected && getProviderControlCapabilities(provider.value).controls.speed;
      speedLabel.hidden = !supported;
      voiceLabel.hidden = !!button.dataset.voiceProfileId;
    }
    refreshProviderControls();

    status = element(documentRef, "p", "প্রোফাইল লোড হচ্ছে…", "pv-status");
    panel.appendChild(status);
    const profileManager = mountPersonalVoiceProfiles({
      documentRef, panel, button, controller, action, setStatus, refreshProviderControls
    });
    catalogManager = mountVoiceCatalog({
      documentRef, panel, action, setStatus, provider, voice, button, storage, refreshProviderControls
    });

    panel.appendChild(action("এই বার্তাটি পড়ুন", async () => {
      close();
      await controller.speak(message, button, { profileId: button.dataset.voiceProfileId || null });
    }, "pv-primary"));

    const styleId = "mosharrof-personal-voice-menu-style";
    if (!documentRef.getElementById(styleId)) {
      const style = element(documentRef, "style");
      style.id = styleId;
      style.textContent = ".personal-voice-menu{position:fixed;z-index:99999;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 76px);max-height:min(72vh,620px);overflow:auto;padding:13px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(18,18,20,.98);color:#f5f5f5;box-shadow:0 12px 40px rgba(0,0,0,.65);font:13px/1.45 system-ui,sans-serif}.pv-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.pv-label{display:block;margin:9px 0;color:#bdbdc5}.pv-select,.pv-input{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #45454b;border-radius:9px;background:#242428;color:#fff}.pv-section-title{margin:14px 0 7px;font-weight:700;color:#ddd}.pv-status,.pv-muted{font-size:12px;color:#aaa;margin:6px 0}.pv-action{padding:8px 10px;border:1px solid #4a4a50;border-radius:9px;background:#242428;color:#fff;font-size:12px}.pv-close{padding:5px 9px}.pv-primary{margin:8px 0;background:#173a28;border-color:#397b53}.pv-profile-row,.pv-catalog-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #333}.pv-profile-row small,.pv-catalog-row small{display:block;color:#aaa;font-size:11px}.pv-check{display:flex;gap:8px;align-items:flex-start;margin:9px 0;color:#ddd;font-size:12px}.pv-check input{margin-top:3px}.pv-controls{display:grid;gap:7px;margin:8px 0}.pv-catalog-row{display:block}.pv-catalog-row audio{width:100%;height:34px;margin-top:5px}";
      documentRef.head.appendChild(style);
    }
    documentRef.body.appendChild(panel);
    await profileManager.loadProfiles();
    await catalogManager.searchCatalog();
    await catalogManager.loadSavedVoices();
  }

  function onPointerDown() {
    holdTimer = setTimeout(() => {
      button.dataset.menuOpened = "true";
      open().catch(() => {});
    }, 650);
  }
  function onPointerUp() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  }
  function onContextMenu(event) {
    event.preventDefault();
    button.dataset.menuOpened = "true";
    open().catch(() => {});
  }
  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("pointerup", onPointerUp);
  button.addEventListener("pointerleave", onPointerUp);
  button.addEventListener("pointercancel", onPointerUp);
  button.addEventListener("contextmenu", onContextMenu);
  return () => {
    onPointerUp();
    close();
    button.removeEventListener("pointerdown", onPointerDown);
    button.removeEventListener("pointerup", onPointerUp);
    button.removeEventListener("pointerleave", onPointerUp);
    button.removeEventListener("pointercancel", onPointerUp);
    button.removeEventListener("contextmenu", onContextMenu);
  };
}
