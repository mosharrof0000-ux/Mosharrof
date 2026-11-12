const API = "https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/personal-voice";
const PROVIDER_KEY = "mosharrof_tts_provider_v1";
const VOICE_KEY = "mosharrof_tts_voice_v1";
const PACE_KEY = "mosharrof_tts_pace_v1";

function element(documentRef, tag, text, className) {
  const node = documentRef.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function accessToken() {
  try {
    const auth = globalThis.MOSHARROF_AUTH || globalThis.mosharrofAuth;
    if (auth && typeof auth.getAccessToken === "function") return Promise.resolve(auth.getAccessToken());
  } catch {}
  try {
    const store = globalThis.localStorage;
    if (!store) return Promise.resolve(null);
    const preferred = "sb-jphortpnuddfsynqyock-auth-token";
    const keys = [preferred];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && /^sb-.+-auth-token$/.test(key) && !keys.includes(key)) keys.push(key);
    }
    for (const key of keys) {
      const raw = store.getItem(key);
      if (!raw) continue;
      const session = JSON.parse(raw);
      if (typeof session?.access_token === "string" && session.access_token.length > 20) return Promise.resolve(session.access_token);
    }
  } catch {}
  return Promise.resolve(null);
}

async function apiRequest(path, options = {}) {
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

function statusText(error) {
  const value = String(error?.message || error);
  const messages = {
    owner_login_required: "Owner Login সেশন পাওয়া যায়নি",
    registered_owner_authentication_required: "Owner Login যাচাই প্রয়োজন",
    personal_voice_request_failed: "ভয়েস সার্ভার এখন প্রস্তুত নয়",
    personal_voice_inference_not_configured: "ক্লোন কণ্ঠের মডেল সার্ভার এখনো সংযুক্ত হয়নি"
  };
  return messages[value] || value.replaceAll("_", " ");
}

export function createPersonalVoiceMenu({ button, message, controller, documentRef = globalThis.document, storage = globalThis.localStorage } = {}) {
  if (!button || !documentRef || !controller) return () => {};
  let panel = null;
  let holdTimer = null;
  let suppressClick = false;

  function close() {
    if (panel) panel.remove();
    panel = null;
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

  let status;
  function setStatus(text) {
    if (status) status.textContent = text;
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
    provider.addEventListener("change", () => { try { storage?.setItem(PROVIDER_KEY, provider.value); } catch {} refreshProviderControls(); });
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
    function refreshProviderControls() {
      const supported = !button.dataset.voiceProfileId && ["edge", "sarvam"].includes(provider.value);
      speedLabel.hidden = !supported;
    }
    refreshProviderControls();

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

    panel.appendChild(element(documentRef, "div", "ব্যক্তিগত কণ্ঠ", "pv-section-title"));
    status = element(documentRef, "p", "প্রোফাইল লোড হচ্ছে…", "pv-status");
    panel.appendChild(status);
    const profilesBox = element(documentRef, "div", undefined, "pv-profiles");
    panel.appendChild(profilesBox);

    const profileControls = element(documentRef, "div", undefined, "pv-controls");
    panel.appendChild(profileControls);

    const addButton = action("＋ নিজের কণ্ঠ যোগ করুন", async () => {
      profileControls.replaceChildren();
      const name = element(documentRef, "input");
      name.type = "text"; name.maxLength = 80; name.placeholder = "কণ্ঠের নাম";
      name.className = "pv-input";
      const transcript = element(documentRef, "textarea");
      transcript.maxLength = 500; transcript.rows = 2; transcript.placeholder = "নমুনায় যে বাক্যটি বলা হবে, হুবহু লিখুন";
      transcript.className = "pv-input";
      const file = element(documentRef, "input");
      file.type = "file"; file.accept = "audio/wav,audio/flac,audio/ogg";
      file.className = "pv-input";
      const voiceConsent = element(documentRef, "label", undefined, "pv-check");
      const voiceCheck = element(documentRef, "input"); voiceCheck.type = "checkbox";
      voiceConsent.append(voiceCheck, element(documentRef, "span", "আমি এই কণ্ঠের মালিক অথবা স্পষ্ট অনুমতি পেয়েছি; কণ্ঠ ব্যবহারে সম্মতি দিচ্ছি"));
      const storageConsent = element(documentRef, "label", undefined, "pv-check");
      const storageCheck = element(documentRef, "input"); storageCheck.type = "checkbox";
      storageConsent.append(storageCheck, element(documentRef, "span", "নমুনা এনক্রিপ্ট করে ব্যক্তিগতভাবে সংরক্ষণে সম্মতি দিচ্ছি"));
      const trainingConsent = element(documentRef, "label", undefined, "pv-check");
      const trainingCheck = element(documentRef, "input"); trainingCheck.type = "checkbox";
      trainingConsent.append(trainingCheck, element(documentRef, "span", "ভবিষ্যৎ মডেল উন্নয়নে আলাদা সম্মতি (ঐচ্ছিক)"));
      profileControls.append(name, transcript, file, voiceConsent, storageConsent, trainingConsent);
      profileControls.appendChild(action("প্রোফাইল তৈরি ও নমুনা সংরক্ষণ", async () => {
        if (!voiceCheck.checked || !storageCheck.checked || !file.files?.[0] || !transcript.value.trim() || !name.value.trim()) {
          throw new Error("নাম, অডিও, হুবহু ট্রান্সক্রিপ্ট এবং দুইটি বাধ্যতামূলক সম্মতি দিন");
        }
        const created = await apiRequest("/profiles", {
          method: "POST",
          body: JSON.stringify({ name: name.value.trim(), language: "bn-BD", consent: { voice_use: true, sample_storage: true, model_training: trainingCheck.checked } })
        });
        const form = new FormData();
        form.append("reference_text", transcript.value.trim());
        form.append("reference_audio", file.files[0]);
        await apiRequest("/profiles/" + encodeURIComponent(created.profile.id) + "/sample", { method: "POST", body: form });
        profileControls.replaceChildren();
        setStatus("কণ্ঠ সংরক্ষিত হয়েছে।");
        await loadProfiles();
      }, "pv-primary"));
      profileControls.appendChild(action("বাতিল", () => profileControls.replaceChildren()));
    }, "pv-primary");
    panel.appendChild(addButton);

    panel.appendChild(element(documentRef, "div", "ভয়েস ক্যাটালগ", "pv-section-title"));
    const catalogSearch = element(documentRef, "input");
    catalogSearch.type = "search"; catalogSearch.placeholder = "নাম দিয়ে খুঁজুন";
    catalogSearch.className = "pv-input";
    const catalogLanguage = element(documentRef, "select", undefined, "pv-select");
    for (const [value, label] of [["", "সব ভাষা"], ["bn-BD", "বাংলা"]]) {
      const option = element(documentRef, "option", label); option.value = value; catalogLanguage.appendChild(option);
    }
    const catalogStyle = element(documentRef, "select", undefined, "pv-select");
    for (const [value, label] of [["", "সব স্টাইল"], ["standard", "স্ট্যান্ডার্ড"]]) {
      const option = element(documentRef, "option", label); option.value = value; catalogStyle.appendChild(option);
    }
    panel.append(catalogSearch, catalogLanguage, catalogStyle);
    const catalogResults = element(documentRef, "div", undefined, "pv-catalog");
    panel.appendChild(catalogResults);
    const savedVoices = element(documentRef, "div", undefined, "pv-saved-voices");
    panel.appendChild(element(documentRef, "div", "আমার সংরক্ষিত ক্যাটালগ ভয়েস", "pv-section-title"));
    panel.appendChild(savedVoices);
    const searchCatalog = async () => {
      catalogResults.replaceChildren();
      try {
        const params = new URLSearchParams({ q: catalogSearch.value.trim(), language: catalogLanguage.value, style: catalogStyle.value });
        const result = await apiRequest("/catalog?" + params.toString());
        if (!result.voices?.length) catalogResults.appendChild(element(documentRef, "p", "এই অনুসন্ধানে কোনো ভয়েস পাওয়া যায়নি।", "pv-muted"));
        for (const voiceItem of result.voices || []) {
          const row = element(documentRef, "div", undefined, "pv-catalog-row");
          row.append(element(documentRef, "strong", voiceItem.display_name), element(documentRef, "small", voiceItem.language + " · " + voiceItem.style + " · " + (voiceItem.available ? "সার্ভার প্রস্তুত" : "সার্ভার অনুপলব্ধ") + " · লাইসেন্স: " + voiceItem.license_status + " · অনুমতি: " + voiceItem.consent_status));
          const controls = element(documentRef, "div", undefined, "pv-catalog-controls");
          controls.appendChild(action("সংরক্ষণ", async () => {
            const saved = await apiRequest("/catalog/saved", { method: "POST", body: JSON.stringify({ catalog_voice_id: voiceItem.id }) });
            setStatus("সংরক্ষিত: " + (saved.voice?.serial || "VOICE"));
            await loadSavedVoices();
          }));
          controls.appendChild(action("প্রিভিউ", async () => {
            if (!voiceItem.available) throw new Error("এই ভয়েস সার্ভার এখন অনুপলব্ধ");
            const response = await fetch("https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/tts", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: "আসসালামু আলাইকুম। এটি কণ্ঠের নমুনা পরীক্ষা।", language_code: voiceItem.language, provider: voiceItem.provider_id, voice: voiceItem.provider_voice_id })
            });
            const audioData = await response.json().catch(() => ({}));
            if (!response.ok || !audioData.audio_data) throw new Error("ভয়েস প্রিভিউ তৈরি হয়নি");
            const binary = atob(audioData.audio_data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            const audio = element(documentRef, "audio"); audio.controls = true; audio.src = URL.createObjectURL(new Blob([bytes], { type: audioData.mime_type || "audio/mpeg" }));
            controls.appendChild(audio);
          }));
          row.appendChild(controls);
          catalogResults.appendChild(row);
        }
      } catch (error) { catalogResults.appendChild(element(documentRef, "p", statusText(error), "pv-muted")); }
    };
    async function loadSavedVoices() {
      savedVoices.replaceChildren();
      try {
        const result = await apiRequest("/catalog/saved");
        for (const saved of result.voices || []) {
          const row = element(documentRef, "div", undefined, "pv-catalog-row");
          row.append(element(documentRef, "strong", saved.voice?.display_name || saved.catalog_voice_id), element(documentRef, "small", saved.serial));
          row.appendChild(action("তালিকা থেকে সরান", async () => {
            await apiRequest("/catalog/saved/" + encodeURIComponent(saved.id), { method: "DELETE" });
            await loadSavedVoices();
          }));
          savedVoices.appendChild(row);
        }
      } catch (error) { savedVoices.appendChild(element(documentRef, "p", statusText(error), "pv-muted")); }
    }
    catalogSearch.addEventListener("change", searchCatalog);
    catalogLanguage.addEventListener("change", searchCatalog);
    catalogStyle.addEventListener("change", searchCatalog);
    catalogSearch.addEventListener("keydown", event => { if (event.key === "Enter") searchCatalog(); });

    const footer = action("এই বার্তাটি পড়ুন", async () => {
      close();
      await controller.speak(message, button, { profileId: button.dataset.voiceProfileId || null });
    }, "pv-primary");
    panel.appendChild(footer);

    const styleId = "mosharrof-personal-voice-menu-style";
    if (!documentRef.getElementById(styleId)) {
      const style = element(documentRef, "style");
      style.id = styleId;
      style.textContent = ".personal-voice-menu{position:fixed;z-index:99999;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 76px);max-height:min(72vh,620px);overflow:auto;padding:13px;border:1px solid rgba(255,255,255,.2);border-radius:16px;background:rgba(18,18,20,.98);color:#f5f5f5;box-shadow:0 12px 40px rgba(0,0,0,.65);font:13px/1.45 system-ui,sans-serif}.pv-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.pv-label{display:block;margin:9px 0;color:#bdbdc5}.pv-select,.pv-input{display:block;width:100%;margin-top:5px;padding:9px;border:1px solid #45454b;border-radius:9px;background:#242428;color:#fff}.pv-section-title{margin:14px 0 7px;font-weight:700;color:#ddd}.pv-status,.pv-muted{font-size:12px;color:#aaa;margin:6px 0}.pv-action{padding:8px 10px;border:1px solid #4a4a50;border-radius:9px;background:#242428;color:#fff;font-size:12px}.pv-close{padding:5px 9px}.pv-primary{margin:8px 0;background:#173a28;border-color:#397b53}.pv-profile-row,.pv-catalog-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #333}.pv-profile-row small,.pv-catalog-row small{display:block;color:#aaa;font-size:11px}.pv-check{display:flex;gap:8px;align-items:flex-start;margin:9px 0;color:#ddd;font-size:12px}.pv-check input{margin-top:3px}.pv-controls{display:grid;gap:7px;margin:8px 0}.pv-catalog-row{display:block}.pv-catalog-row audio{width:100%;height:34px;margin-top:5px}";
      documentRef.head.appendChild(style);
    }
    documentRef.body.appendChild(panel);

    async function loadProfiles() {
      profilesBox.replaceChildren();
      try {
        const data = await apiRequest("/profiles");
        if (!button.dataset.voiceProfileId && data.default_profile_id) button.dataset.voiceProfileId = data.default_profile_id;
        refreshProviderControls();
        setStatus(data.profiles?.length ? "সংরক্ষিত কণ্ঠ নির্বাচন করুন" : "এখনো কোনো ব্যক্তিগত কণ্ঠ নেই");
        for (const profile of data.profiles || []) {
          const row = element(documentRef, "div", undefined, "pv-profile-row");
          const info = element(documentRef, "div");
          info.append(element(documentRef, "strong", profile.name + " · " + profile.serial));
          info.appendChild(element(documentRef, "small", profile.status === "active" ? "ব্যবহারযোগ্য" : "নিষ্ক্রিয়"));
          const choose = action(button.dataset.voiceProfileId === profile.id ? "নির্বাচিত" : "এই বার্তার জন্য", () => {
            button.dataset.voiceProfileId = profile.id;
            refreshProviderControls();
            setStatus(profile.name + " এই বার্তার কণ্ঠ হিসেবে নির্বাচিত");
          });
          row.append(info, choose);
          const controls = element(documentRef, "div", undefined, "pv-profile-row");
          controls.append(action("ডিফল্ট করুন", async () => {
            await apiRequest("/preferences/default", { method: "PUT", body: JSON.stringify({ profile_id: profile.id }) });
            setStatus("ডিফল্ট কণ্ঠ সংরক্ষিত হয়েছে");
          }), action("নাম বদল", async () => {
            const next = globalThis.prompt?.("নতুন কণ্ঠের নাম", profile.name);
            if (next && next.trim()) {
              await apiRequest("/profiles/" + encodeURIComponent(profile.id), { method: "PATCH", body: JSON.stringify({ name: next.trim() }) });
              await loadProfiles();
            }
          }), action("মুছুন", async () => {
            if (!globalThis.confirm?.("এই কণ্ঠ ও নমুনা মুছে ফেলবেন?")) return;
            await apiRequest("/profiles/" + encodeURIComponent(profile.id), { method: "DELETE" });
            if (button.dataset.voiceProfileId === profile.id) delete button.dataset.voiceProfileId;
            await loadProfiles();
          }));
          profilesBox.append(row, controls);
        }
      } catch (error) {
        setStatus(statusText(error) + " · ব্যক্তিগত কণ্ঠের জন্য Owner Login প্রয়োজন");
        addButton.disabled = true;
      }
    }
    await loadProfiles();
    await searchCatalog();
    await loadSavedVoices();
  }

  function onPointerDown() {
    suppressClick = false;
    holdTimer = setTimeout(() => {
      suppressClick = true;
      button.dataset.menuOpened = "true";
      open().catch(() => {});
    }, 650);
  }
  function onPointerUp() { if (holdTimer) clearTimeout(holdTimer); holdTimer = null; }
  function onContextMenu(event) {
    event.preventDefault();
    suppressClick = true;
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
