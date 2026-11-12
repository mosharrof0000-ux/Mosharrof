import { apiRequest, element, signIn, statusText } from "./personal-voice-menu-api.js";

export function mountPersonalVoiceProfiles({ documentRef, panel, button, action, setStatus, refreshProviderControls }) {
  const profilesBox = element(documentRef, "div", undefined, "pv-profiles");
  const profileControls = element(documentRef, "div", undefined, "pv-controls");
  let enrollmentReady = false;
  panel.append(element(documentRef, "div", "ব্যক্তিগত কণ্ঠ", "pv-section-title"), profilesBox, profileControls);

  const addButton = action("＋ নিজের কণ্ঠ যোগ করুন", async () => {
    profileControls.replaceChildren();
    const name = element(documentRef, "input"); name.type = "text"; name.maxLength = 80; name.placeholder = "কণ্ঠের নাম"; name.className = "pv-input";
    const transcript = element(documentRef, "textarea"); transcript.maxLength = 500; transcript.rows = 2; transcript.placeholder = "নমুনায় যে বাক্যটি বলা হবে, হুবহু লিখুন"; transcript.className = "pv-input";
    const file = element(documentRef, "input"); file.type = "file"; file.accept = "audio/wav,audio/flac,audio/ogg"; file.className = "pv-input";
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
  panel.appendChild(action("এই বার্তার ব্যক্তিগত কণ্ঠ সরান", () => {
    delete button.dataset.voiceProfileId;
    refreshProviderControls();
    setStatus("এই বার্তায় সাধারণ TTS ভয়েস ব্যবহার হবে");
  }));

  async function loadProfiles() {
    profilesBox.replaceChildren();
    try {
      const readiness = await apiRequest("/readiness");
      enrollmentReady = readiness.ready === true;
      addButton.disabled = !enrollmentReady;
      addButton.title = enrollmentReady ? "" : "নিরাপদ স্টোরেজ ও ইনফারেন্স সার্ভার প্রস্তুত নয়";
      const data = await apiRequest("/profiles");
      if (!button.dataset.voiceProfileId && data.default_profile_id) button.dataset.voiceProfileId = data.default_profile_id;
      refreshProviderControls();
      setStatus(data.profiles?.length ? "সংরক্ষিত কণ্ঠ নির্বাচন করুন" : enrollmentReady ? "এখনো কোনো ব্যক্তিগত কণ্ঠ নেই" : "কণ্ঠ নিবন্ধন বন্ধ: নিরাপদ সার্ভার প্রস্তুত নয়");
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
        if (profile.status === "active") controls.appendChild(action("নমুনা বদল", async () => {
          profileControls.replaceChildren();
          const transcript = element(documentRef, "textarea"); transcript.rows = 2; transcript.maxLength = 500; transcript.placeholder = "নতুন নমুনার হুবহু ট্রান্সক্রিপ্ট"; transcript.className = "pv-input";
          const file = element(documentRef, "input"); file.type = "file"; file.accept = "audio/wav,audio/flac,audio/ogg"; file.className = "pv-input";
          profileControls.append(transcript, file);
          profileControls.appendChild(action("নতুন নমুনা সংরক্ষণ", async () => {
            if (!file.files?.[0] || !transcript.value.trim()) throw new Error("অডিও ও হুবহু ট্রান্সক্রিপ্ট দিন");
            const form = new FormData();
            form.append("reference_text", transcript.value.trim());
            form.append("reference_audio", file.files[0]);
            await apiRequest("/profiles/" + encodeURIComponent(profile.id) + "/sample", { method: "POST", body: form });
            profileControls.replaceChildren();
            setStatus("নতুন নমুনা সংরক্ষিত হয়েছে");
            await loadProfiles();
          }, "pv-primary"));
          profileControls.appendChild(action("বাতিল", () => profileControls.replaceChildren()));
        }));
        controls.append(action("ডিফল্ট করুন", async () => {
          await apiRequest("/preferences/default", { method: "PUT", body: JSON.stringify({ profile_id: profile.id }) });
          setStatus("ডিফল্ট কণ্ঠ সংরক্ষণ করা হয়েছে");
        }), action("নাম বদল", async () => {
          const next = globalThis.prompt?.("নতুন কণ্ঠের নাম", profile.name);
          if (next && next.trim()) {
            await apiRequest("/profiles/" + encodeURIComponent(profile.id), { method: "PATCH", body: JSON.stringify({ name: next.trim() }) });
            await loadProfiles();
          }
        }), action("ব্যবহারের সম্মতি প্রত্যাহার", async () => {
          if (!globalThis.confirm?.("এই কণ্ঠের ব্যবহার বন্ধ করবেন?")) return;
          await apiRequest("/profiles/" + encodeURIComponent(profile.id), { method: "PATCH", body: JSON.stringify({ consent: { voice_use: false } }) });
          if (button.dataset.voiceProfileId === profile.id) delete button.dataset.voiceProfileId;
          await loadProfiles();
        }), action("নমুনা ও সংরক্ষণ মুছুন", async () => {
          if (!globalThis.confirm?.("সংরক্ষিত নমুনা স্থায়ীভাবে মুছবেন?")) return;
          await apiRequest("/profiles/" + encodeURIComponent(profile.id), { method: "PATCH", body: JSON.stringify({ consent: { sample_storage: false } }) });
          if (button.dataset.voiceProfileId === profile.id) delete button.dataset.voiceProfileId;
          await loadProfiles();
        }), action("মুছুন", async () => {
          if (!globalThis.confirm?.("এই কণ্ঠ ও নমুনা মুছে ফেলবেন?")) return;
          await apiRequest("/profiles/" + encodeURIComponent(profile.id), { method: "DELETE" });
          if (button.dataset.voiceProfileId === profile.id) delete button.dataset.voiceProfileId;
          await loadProfiles();
        }));
        profilesBox.append(row, controls);
      }
    } catch (error) {
      setStatus(statusText(error) + " · Owner Login প্রয়োজন");
      addButton.disabled = true;
      profilesBox.replaceChildren();
      const loginBox = element(documentRef, "div", undefined, "pv-login");
      const email = element(documentRef, "input"); email.type = "email"; email.autocomplete = "username"; email.placeholder = "Owner email"; email.className = "pv-input";
      const password = element(documentRef, "input"); password.type = "password"; password.autocomplete = "current-password"; password.placeholder = "Password"; password.className = "pv-input";
      loginBox.append(email, password, action("Owner Login", async () => {
        await signIn(email.value, password.value);
        await loadProfiles();
      }, "pv-primary"));
      profilesBox.appendChild(loginBox);
    }
  }
  return { loadProfiles };
}
