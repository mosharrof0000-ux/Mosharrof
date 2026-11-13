import { apiRequest, element, statusText } from "./personal-voice-menu-api.js";

export function buildCatalogQuery({ query = "", language = "", style = "" } = {}) {
  return new URLSearchParams({ q: String(query).trim(), language: String(language), style: String(style) });
}

export function catalogVoiceUsable(voice) {
  return voice?.available === true;
}

export function mountVoiceCatalog({ documentRef, panel, action, setStatus, provider, voice, button, storage, refreshProviderControls }) {
  panel.appendChild(element(documentRef, "div", "ভয়েস ক্যাটালগ", "pv-section-title"));
  const catalogSearch = element(documentRef, "input");
  catalogSearch.type = "search"; catalogSearch.placeholder = "নাম দিয়ে খুঁজুন"; catalogSearch.className = "pv-input";
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
  panel.append(element(documentRef, "div", "আমার সংরক্ষিত ক্যাটালগ ভয়েস", "pv-section-title"), savedVoices);

  async function searchCatalog() {
    catalogResults.replaceChildren();
    try {
      const params = buildCatalogQuery({ query: catalogSearch.value, language: catalogLanguage.value, style: catalogStyle.value });
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
          if (!catalogVoiceUsable(voiceItem)) throw new Error("এই ভয়েস সার্ভার বা লাইসেন্স অনুমতি যাচাইকৃত নয়");
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
          objectUrls.add(audio.src);
          controls.appendChild(audio);
        }));
        row.appendChild(controls);
        catalogResults.appendChild(row);
      }
    } catch (error) { catalogResults.appendChild(element(documentRef, "p", statusText(error), "pv-muted")); }
  }

  async function loadSavedVoices() {
    savedVoices.replaceChildren();
    try {
      const result = await apiRequest("/catalog/saved");
      for (const saved of result.voices || []) {
        const row = element(documentRef, "div", undefined, "pv-catalog-row");
        row.append(element(documentRef, "strong", saved.voice?.display_name || saved.catalog_voice_id), element(documentRef, "small", saved.serial + " · " + (saved.voice?.available ? "ব্যবহারের অনুমতি যাচাইকৃত" : "লাইসেন্স/অনুমতি বা সার্ভার যাচাই বাকি")));
        const useSaved = action("এই বার্তায় ব্যবহার", () => {
          if (!saved.voice?.available) throw new Error("এই ক্যাটালগ ভয়েসের লাইসেন্স, সম্মতি ও সার্ভার যাচাই সম্পূর্ণ নয়");
          if (saved.voice?.provider_id) provider.value = saved.voice.provider_id;
          if (saved.voice?.provider_voice_id) voice.value = saved.voice.provider_voice_id;
          delete button.dataset.voiceProfileId;
          button.dataset.voiceProfileDisabled = "true";
          refreshProviderControls();
          try { storage?.setItem("mosharrof_tts_provider_v1", provider.value); storage?.setItem("mosharrof_tts_voice_v1", voice.value); } catch {}
          setStatus(saved.serial + " ভয়েস এই বার্তার জন্য নির্বাচিত");
        });
        useSaved.disabled = !catalogVoiceUsable(saved.voice);
        row.appendChild(useSaved);
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
  return { searchCatalog, loadSavedVoices, dispose() { for (const url of objectUrls) URL.revokeObjectURL(url); objectUrls.clear(); } };
}
