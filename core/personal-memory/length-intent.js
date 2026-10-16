const PATTERNS = [
  { mode: "short", score: 1, re: /\b(short|brief|concise|summari[sz]e|in one paragraph)\b|সংক্ষেপে|ছোট করে|সংক্ষিপ্ত|একটু বলো|এক কথায়/i },
  { mode: "detailed", score: 2, re: /\b(detailed|in depth|explain fully|comprehensive|step by step)\b|বিস্তারিত|খুলে বলো|ধাপে ধাপে|পুরো ঘটনা|ভালোভাবে বুঝিয়ে/i },
  { mode: "long", score: 3, re: /\b(novel|long story|full length|very long|thousand words|\d{3,5}\s*words?)\b|উপন্যাস|দীর্ঘ গল্প|অনেক বড়|বড় করে|হাজার শব্দ|\d{3,5}\s*(?:শব্দ|ওয়ার্ড)/i }
];
export function inferResponseStyle(message, retrievedPreferences = []) {
  const text = String(message || "");
  const explicit = text.match(/(?:\b|^)(\d{1,2})\s*(?:k|thousand)\s*words?\b|(?:^|\s)(\d{3,5})\s*(?:words?|শব্দ|ওয়ার্ড)/i);
  if (explicit) {
    const count = Number(explicit[1] || explicit[2]) * (/k|thousand/i.test(explicit[0]) ? 1000 : 1);
    return { mode: "explicit-length", requestedWords: Math.min(20000, count), source: "current-message", confidence: 0.99 };
  }
  const matched = PATTERNS.find(item => item.re.test(text));
  if (matched) return { mode: matched.mode, source: "current-message", confidence: 0.9 };
  const preference = retrievedPreferences.find(item => item.folder === "preferences-and-style" && item.userApproved);
  return preference ? { mode: "personalized-default", source: "approved-memory", confidence: Math.min(0.8, preference.confidence) } : { mode: "normal", source: "default", confidence: 0.55 };
}
