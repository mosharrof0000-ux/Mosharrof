/* MOSHARROF Android agent planner foundation.
 * Produces a previewable plan only. It does not tap, launch apps, change settings,
 * record audio, capture the screen, or send any data.
 */
(function (root) {
  "use strict";
  const ACTIONS = {
    open_wifi_settings: { risk: "navigation", requiresConfirmation: false, capability: "DeviceControl.openWifiSettings" },
    open_bluetooth_settings: { risk: "navigation", requiresConfirmation: false, capability: "DeviceControl.openBluetoothSettings" },
    open_display_settings: { risk: "navigation", requiresConfirmation: false, capability: "DeviceControl.openDisplaySettings" },
    open_accessibility_settings: { risk: "navigation", requiresConfirmation: false, capability: "DeviceControl.openAccessibilitySettings" },
    open_app_settings: { risk: "navigation", requiresConfirmation: false, capability: "DeviceControl.openAppSettings" },
    unsupported_setting_change: { risk: "unsupported", requiresConfirmation: true, capability: null }
  };
  function normalize(s) {
    return String(s || "").toLocaleLowerCase("bn").normalize("NFKC")
      .replace(/[\u200b-\u200f\uFEFF]/g, "").replace(/[।!?.,]/g, " ").replace(/\s+/g, " ").trim();
  }
  function step(action, title, reason) {
    const meta = ACTIONS[action];
    return { action, title, risk: meta.risk, requiresConfirmation: meta.requiresConfirmation,
      capability: meta.capability, reason: reason || "" };
  }
  function planCommand(input) {
    const text = normalize(input);
    if (!text) return { status: "needs_clarification", reason: "কমান্ডটি শুনতে বা পড়তে পারিনি।", steps: [] };
    if (/(পাসওয়ার্ড|পাসওয়ার্ড|ওটিপি|otp|password|pin code|পিন কোড|টাকা পাঠাও|টাকা ট্রান্সফার|send money|payment|পেমেন্ট|কিনে ফেল|purchase|uninstall|ডিলিট করে দাও|সব মুছে)/i.test(text)) {
      return { status: "blocked_for_confirmation", reason: "এই নির্দেশে সংবেদনশীল বা ধ্বংসাত্মক কাজ থাকতে পারে। নিরাপদ স্বয়ংক্রিয় পরিকল্পনা তৈরি করা হয়নি।", steps: [] };
    }
    const steps = [];
    if (/(wifi|wi-fi|ওয়াই.?ফাই|ওয়াই.?ফাই)/i.test(text)) {
      if (/(চালু|অন কর|on কর|enable|turn on)/i.test(text)) {
        steps.push(step("open_wifi_settings", "Wi‑Fi সেটিংস খুলুন", "Android-এর সেটিংসে গিয়ে মালিক নিজে Wi‑Fi চালু করবেন।"));
      } else if (/(বন্ধ|অফ কর|off কর|disable|turn off)/i.test(text)) {
        steps.push(step("open_wifi_settings", "Wi‑Fi সেটিংস খুলুন", "Android-এর সেটিংসে গিয়ে মালিক নিজে Wi‑Fi বন্ধ করবেন।"));
      } else steps.push(step("open_wifi_settings", "Wi‑Fi সেটিংস খুলুন", "কোনো সরাসরি টগল করা হচ্ছে না।"));
    }
    if (/(bluetooth|ব্লুটুথ)/i.test(text)) {
      steps.push(step("open_bluetooth_settings", "Bluetooth সেটিংস খুলুন", "সরাসরি চালু/বন্ধ করার বদলে Android সেটিংস খোলা হবে।"));
    }
    if (/(brightness|উজ্জ্বলতা|ব্রাইটনেস|display|ডিসপ্লে)/i.test(text)) {
      steps.push(step("open_display_settings", "Display সেটিংস খুলুন", "ব্রাইটনেসের নির্দিষ্ট শতাংশ সরাসরি সেট করা এই planner-এ এখনো সমর্থিত নয়।"));
    }
    if (/(accessibility|অ্যাক্সেসিবিলিটি|অ্যাক্সেসিবিলিটি সার্ভিস)/i.test(text)) {
      steps.push(step("open_accessibility_settings", "Accessibility সেটিংস খুলুন", "সার্ভিসটি মালিককে নিজে চালু করতে হবে।"));
    }
    if (/(app settings|অ্যাপ সেটিংস|ইনস্টল করা অ্যাপ)/i.test(text)) {
      steps.push(step("open_app_settings", "অ্যাপ সেটিংস খুলুন", "এটি কেবল Android-এর অ্যাপ সেটিংস পৃষ্ঠা খুলবে।"));
    }
    if (!steps.length) return { status: "unsupported", reason: "এই কমান্ডের জন্য এখনো যাচাইকৃত native action নেই। কোনো কাজ চালানো হয়নি।", steps: [] };
    return { status: "preview", reason: "এটি কেবল পরিকল্পনা। native capability, অনুমতি এবং প্রয়োজনীয় ব্যবহারকারী সম্মতি ছাড়া কোনো action চলবে না।", steps };
  }
  const api = Object.freeze({ planCommand });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidAgentPlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
