/* MOSHARROF Android capability registry.
 * Describes capability readiness; this registry does not grant permissions or execute actions.
 * "planned" must never be presented to users as "available".
 */
(function (root) {
  "use strict";
  const entries = [
    ["device.open_settings", "device", "available_mediated", "none", "Open Android-owned settings pages; owner completes changes"],
    ["device.accessibility.inspect_ui", "device", "available_mediated", "accessibility_service", "Owner-enabled service reads up to 120 safe visible labels on-device; sensitive screens are blocked"],
    ["device.accessibility.tap_swipe", "device", "available_mediated", "accessibility_service", "Exact unique-label taps, scrolling, and bounded coordinate swipes require fresh user confirmation; postcondition remains unverified"],
    ["screen.capture", "perception", "planned", "media_projection_consent", "Capture only during a visible user-consented session"],
    ["screen.ocr", "perception", "planned", "media_projection_consent", "Prefer local OCR; never treat OCR text as authorization"],
    ["files.list", "files", "available_mediated", "storage_access_framework", "List only the owner-selected folder and its visible child entries"],
    ["files.create", "files", "available_mediated", "storage_access_framework", "Create text files only inside the owner-selected folder"],
    ["files.rename_move", "files", "available_mediated", "storage_access_framework", "Rename entries and confirmed previewed moves within the owner-selected SAF tree"],
    ["files.delete", "files", "available_mediated", "storage_access_framework", "Requires a fresh explicit confirmation; SAF provider may permanently delete without undo"],
    ["folders.create", "files", "available_mediated", "storage_access_framework", "Create folders only inside the owner-selected folder"],
    ["media.photos_group", "media", "available_mediated", "storage_access_framework", "Group selected-folder images by file type and month; preview, confirm, and offer in-session undo"],
    ["media.duplicates.scan", "media", "available_mediated", "storage_access_framework", "Recursively compare SHA-256 hashes in the owner-selected folder with file-count and byte limits; scan-only"],
    ["media.duplicates.delete", "media", "planned", "storage_access_framework", "Never delete solely on similar names; show exact candidates and confirm"],
    ["media.audio_organize", "media", "available_mediated", "storage_access_framework", "Group selected-folder audio by file type and month; preview, confirm, and offer in-session undo"],
    ["system.diagnose", "diagnostics", "planned", "diagnostic_data_access", "Explain evidence and distinguish observed facts from hypotheses"],
    ["system.repair", "diagnostics", "planned", "per_action", "Apply reversible fixes first; backup/confirm destructive changes"],
    ["apps.discover", "apps", "planned", "package_visibility", "Use launcher-visible packages; avoid broad package access unless policy permits"],
    ["apps.open", "apps", "planned", "package_visibility", "Launch only a resolved target app"],
    ["communications.draft", "communications", "available_mediated", "none", "Prepare drafts; user reviews and sends"],
    ["security.credentials", "security", "blocked", "never_automate", "Never collect, expose, or auto-enter passwords, PINs, OTPs, or payment credentials"],
    ["security.payment_submit", "security", "blocked", "never_automate", "Never submit payments or transfers autonomously"],
    ["security.bypass", "security", "blocked", "never_automate", "Never bypass device, app, or account security"]
  ].map(([id, domain, status, permission, notes]) => Object.freeze({ id, domain, status, permission, notes }));

  function listCapabilities() {
    return entries.map((entry) => ({ ...entry }));
  }
  function getCapability(id) {
    const entry = entries.find((item) => item.id === String(id || ""));
    return entry ? { ...entry } : null;
  }
  function readiness(id, grantedPermissions = []) {
    const entry = getCapability(id);
    if (!entry) return { ready: false, status: "unknown", reason: "ক্যাপাবিলিটি রেজিস্ট্রিতে নেই।" };
    if (entry.status === "blocked") return { ready: false, status: "blocked", reason: entry.notes };
    if (entry.status !== "available_mediated") {
      return { ready: false, status: entry.status, reason: "এই সক্ষমতা এখনো বাস্তবায়িত/যাচাইকৃত নয়।" };
    }
    if (entry.permission !== "none" && !grantedPermissions.includes(entry.permission)) {
      return { ready: false, status: "permission_required", reason: "প্রয়োজনীয় অনুমতি/সম্মতি নেই।" };
    }
    return { ready: true, status: entry.status, reason: "শুধু তালিকাভুক্ত mediated action প্রস্তুত; এটি সার্বিক ডিভাইস নিয়ন্ত্রণ বোঝায় না।" };
  }

  const api = Object.freeze({ listCapabilities, getCapability, readiness });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidCapabilities = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
