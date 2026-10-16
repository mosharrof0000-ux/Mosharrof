/* MOSHARROF Android task planner: typed plans only, never executes device/file actions.
 * Native adapters must independently enforce SAF grants, policy, confirmation, and verification.
 */
(function (root) {
  "use strict";
  const ACTIONS = Object.freeze({
    files_list: { capability: "files.list", risk: "read_only" },
    files_create: { capability: "files.create", risk: "reversible" },
    folder_create: { capability: "folders.create", risk: "reversible" },
    files_organize: { capability: "files.rename_move", risk: "reversible" },
    photos_group: { capability: "media.photos_group", risk: "reversible" },
    duplicates_scan: { capability: "media.duplicates.scan", risk: "read_only" },
    duplicates_review: { capability: "media.duplicates.delete", risk: "destructive_review" },
    diagnose: { capability: "system.diagnose", risk: "read_only" },
    repair_plan: { capability: "system.repair", risk: "reversible_review" },
    app_discover: { capability: "apps.discover", risk: "read_only" },
    app_open: { capability: "apps.open", risk: "navigation" }
  });
  const rules = [
    { re: /(ঠিক কর|সমাধান|repair|fix).*(সমস্যা|ত্রুটি|error|bug|অ্যাপ|সিস্টেম)|(সমস্যা|ত্রুটি|error|bug).*(ঠিক কর|সমাধান|repair|fix)/i, action: "repair_plan", title: "সমাধানের পরিকল্পনা", note: "প্রমাণভিত্তিক, reversible ধাপ আগে; ঝুঁকিপূর্ণ পরিবর্তনের আগে backup/confirmation।" },
    { re: /(সমস্যা|ত্রুটি|error|bug|কাজ করছে না|কেন চলছে না|diagnos)/i, action: "diagnose", title: "সমস্যা নির্ণয়", note: "প্রথমে দৃশ্যমান প্রমাণ ও non-sensitive logs পরীক্ষা; অনুমানকে সত্য বলা যাবে না।" },
    { re: /(ডুপ্লিকেট|নকল|একই গান|একই ছবি|duplicate)/i, action: "duplicates_scan", title: "ডুপ্লিকেট ফাইল স্ক্যান", note: "শুধু তালিকা ও hash-ভিত্তিক মিল দেখাবে; কিছু মুছবে না।" },
    { re: /(ছবি|ফটো|photo|picture).*(ফোল্ডার|আলাদা|সাজাও|গোছাও|organize)|(ফোল্ডার|আলাদা|সাজাও|গোছাও).*(ছবি|ফটো|photo|picture)/i, action: "photos_group", title: "ছবির গ্রুপ সাজানোর প্রস্তাব", note: "মূল ছবি না সরিয়ে আগে প্রস্তাব দেখাতে হবে।" },
    { re: /(গান|মিউজিক|অডিও|music|audio).*(সাজাও|গোছাও|ফোল্ডার|আলাদা|organize)|(সাজাও|গোছাও|organize).*(গান|মিউজিক|অডিও|music|audio)/i, action: "files_organize", title: "গান/অডিও সাজানোর প্রস্তাব", note: "মেটাডেটা ও গন্তব্য দেখিয়ে অনুমোদনের আগে কোনো ফাইল সরাবে না।" },
    { re: /(ফোল্ডার|folder).*(তৈরি|বানাও|create)|((তৈরি|বানাও|create).*(ফোল্ডার|folder))/i, action: "folder_create", title: "ফোল্ডার তৈরি", note: "শুধু ব্যবহারকারী নির্বাচিত/অনুমোদিত ফোল্ডারের ভেতরে।" },
    { re: /(ফাইল|file).*(তৈরি|লিখে|বানাও|create)|((তৈরি|বানাও|create).*(ফাইল|file))/i, action: "files_create", title: "ফাইল তৈরি", note: "নাম, বিষয়বস্তু ও অনুমোদিত গন্তব্য দেখিয়ে তৈরি করতে হবে।" },
    { re: /(ফাইল|ফোল্ডার|ছবি|গান|মেমোরি|storage|file|folder).*(ডিলিট|মুছ|delete)/i, action: "duplicates_review", title: "মুছবার আগে পর্যালোচনা", note: "এটি শুধু review-plan; নির্দিষ্ট আইটেম বাছাই ও নতুন নিশ্চিতকরণ ছাড়া কিছু মুছবে না।" },
    { re: /(অ্যাপ|app).*(খুল|চালু|open|launch)/i, action: "app_open", title: "অ্যাপ খোলার অনুরোধ", note: "অ্যাপের নাম নিশ্চিতভাবে resolve না হলে কিছু খুলবে না।" },
    { re: /(কোন কোন অ্যাপ|ইনস্টল করা অ্যাপ|installed apps|অ্যাপ দেখাও)/i, action: "app_discover", title: "দৃশ্যমান অ্যাপের তালিকা", note: "Android package visibility-র সীমার মধ্যে।" },
    { re: /(ফাইল|ফোল্ডার|ছবি|গান|মেমোরি|storage|file|folder).*(দেখাও|তালিকা|list|খুঁজে)/i, action: "files_list", title: "অনুমোদিত ফাইল/ফোল্ডার তালিকা", note: "শুধু ব্যবহারকারী-অনুমোদিত storage location।" }
  ];
  function planCommand(input) {
    const text = String(input || "").normalize("NFKC").toLocaleLowerCase("bn")
      .replace(/[\u200b-\u200f\uFEFF]/g, "").replace(/\s+/g, " ").trim();
    if (!text) return { status: "needs_clarification", reason: "নির্দেশটি পাওয়া যায়নি।", steps: [] };
    if (/(পাসওয়ার্ড|পাসওয়ার্ড|password|otp|ওটিপি|পিন কোড|pin code|ব্যাংক.*টাকা|টাকা পাঠাও|payment|পেমেন্ট.*কর)/i.test(text)) {
      return { status: "blocked", reason: "গোপন তথ্য বা আর্থিক কাজ স্বয়ংক্রিয়ভাবে করা যাবে না।", steps: [] };
    }
    // Repair intent must outrank generic diagnosis even when Bengali inflections vary.
    const repairIntent =
      (/(সমস্যা|ত্রুটি|error|bug|কাজ করছে না|সমাধানযোগ্য)/i.test(text) &&
       /(ঠিক|সমাধান|মেরামত|repair|fix|সারাও)/i.test(text)) ||
      /(ঠিক|সমাধান|মেরামত|repair|fix|সারাও).*(সমস্যা|ত্রুটি|error|bug|অ্যাপ|সিস্টেম)/i.test(text) ||
      /(সমস্যা|ত্রুটি|error|bug|অ্যাপ|সিস্টেম).*(ঠিক|সমাধান|মেরামত|repair|fix|সারাও)/i.test(text);
    const matched = repairIntent
      ? rules.find(rule => rule.action === "repair_plan")
      : rules.find(rule => rule.re.test(text));
    if (!matched) return { status: "unsupported", reason: "এই নির্দেশের জন্য যাচাইকৃত action mapping নেই; কোনো কাজ চালানো হয়নি।", steps: [] };
    const meta = ACTIONS[matched.action];
    return { status: "preview", reason: "এটি পরিকল্পনা মাত্র—বাস্তবায়নের জন্য native adapter, প্রয়োজনীয় অনুমতি, review এবং ফলাফল যাচাই লাগবে।",
      steps: [{ action: matched.action, capability: meta.capability, risk: meta.risk,
        title: matched.title, note: matched.note, requiresReview: meta.risk.includes("review") || meta.risk === "destructive_review" }] };
  }
  const api = Object.freeze({ planCommand });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidTaskPlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
