/* MOSHARROF Android SAF file manager facade.
 * Native operations are limited to a folder explicitly selected by the owner.
 * This facade never silently deletes or moves files.
 */
(function (root) {
  "use strict";
  function nativePlugin() {
    const capacitor = root.Capacitor;
    const plugins = capacitor && capacitor.Plugins;
    const plugin = plugins && plugins.MosharrofFiles;
    if (!plugin) throw new Error("Android file manager bridge unavailable; install the native APK and select an authorized folder.");
    return plugin;
  }
  function requireName(value) {
    const name = String(value || "").trim();
    if (!name || name === "." || name === ".." || /[\\/\\0]/.test(name)) {
      throw new Error("ফাইল বা ফোল্ডারের নাম বৈধ নয়।");
    }
    return name;
  }
  async function pickDirectory() { return nativePlugin().pickDirectory(); }
  async function getSelectedDirectory() { return nativePlugin().getSelectedDirectory(); }
  async function listEntries() { return nativePlugin().listEntries(); }
  async function createFolder(name) { return nativePlugin().createFolder({ name: requireName(name) }); }
  async function createTextFile(name, content) {
    return nativePlugin().createTextFile({ name: requireName(name), content: String(content ?? "") });
  }
  async function renameEntry(id, name) {
    if (!String(id || "").trim()) throw new Error("ফাইলের পরিচয় পাওয়া যায়নি।");
    return nativePlugin().renameEntry({ id: String(id), name: requireName(name) });
  }
  async function deleteEntry(id, confirmed) {
    if (confirmed !== true) throw new Error("মুছে ফেলার আগে স্পষ্ট নিশ্চিতকরণ দরকার।");
    if (!String(id || "").trim()) throw new Error("ফাইলের পরিচয় পাওয়া যায়নি।");
    return nativePlugin().deleteEntry({ id: String(id), confirmed: true });
  }

  async function scanExactDuplicates(files) {
    if (!root.crypto || !root.crypto.subtle) throw new Error("এই পরিবেশে নিরাপদ SHA-256 পরীক্ষা নেই।");
    const rows = [];
    for (const file of Array.from(files || [])) {
      const bytes = await file.arrayBuffer();
      const digest = await root.crypto.subtle.digest("SHA-256", bytes);
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      rows.push({ name: file.name, size: file.size, type: file.type || "", lastModified: file.lastModified || 0, hash, file });
    }
    const groups = new Map();
    for (const row of rows) {
      const key = row.size + ":" + row.hash;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return {
      scanned: rows.length,
      exactDuplicateGroups: Array.from(groups.values()).filter(group => group.length > 1)
        .map(group => ({ hash: group[0].hash, size: group[0].size,
          files: group.map(({ name, size, type, lastModified }) => ({ name, size, type, lastModified })) })),
      note: "শুধু একই আকার ও SHA-256 hash-এর ফাইলকে exact duplicate হিসেবে দেখানো হয়েছে; কোনো ফাইল মুছা হয়নি।"
    };
  }

  const api = Object.freeze({ pickDirectory, getSelectedDirectory, listEntries, createFolder,
    createTextFile, renameEntry, deleteEntry, scanExactDuplicates });
  root.MosharrofFiles = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
