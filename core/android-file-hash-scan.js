/* Browser-selected file SHA-256 scanner; read-only and bounded by the caller's selection. */
(function (root) {
  "use strict";
  async function scanExactDuplicates(files) {
    if (!root.crypto || !root.crypto.subtle) throw new Error("এই পরিবেশে নিরাপদ SHA-256 পরীক্ষা নেই।");
    const rows = [];
    for (const file of Array.from(files || [])) {
      const bytes = await file.arrayBuffer();
      const digest = await root.crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      rows.push({ name: file.name, size: file.size, type: file.type || "",
        lastModified: file.lastModified || 0, hash });
    }
    const groups = new Map();
    for (const row of rows) {
      const key = row.size + ":" + row.hash;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return { scanned: rows.length,
      exactDuplicateGroups: Array.from(groups.values()).filter(group => group.length > 1)
        .map(group => ({ hash: group[0].hash, size: group[0].size, files: group })),
      note: "শুধু একই আকার ও SHA-256 hash-এর ফাইলকে exact duplicate হিসেবে দেখানো হয়েছে; কোনো ফাইল মুছা হয়নি।" };
  }
  const api = Object.freeze({ scanExactDuplicates });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofFileHashScan = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
