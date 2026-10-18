/* MOSHARROF Android SAF file manager facade.
 * Native operations are limited to a folder explicitly selected by the owner.
 * This facade never silently deletes or moves files.
 */
(function (root) {
  "use strict";
  function nativePlugin() {
    const capacitor = root.Capacitor;
    const plugins = capacitor && capacitor.Plugins;
    const plugin = plugins && plugins.AndroidFileManager;
    if (!plugin) throw new Error("Android file manager bridge unavailable; install the native APK and select an authorized folder.");
    return plugin;
  }
  function requireName(value) {
    const name = String(value || "").trim();
    if (!name || name === "." || name === ".." || /[\\/\0]/.test(name)) {
      throw new Error("ফাইল বা ফোল্ডারের নাম বৈধ নয়।");
    }
    return name;
  }
  async function pickDirectory() { return nativePlugin().chooseFolder(); }
  async function getSelectedDirectory() { return nativePlugin().getSelectedDirectory(); }
  async function listEntries() { return nativePlugin().listItems(); }
  async function createFolder(name) { return nativePlugin().createFolder({ name: requireName(name) }); }
  async function createTextFile(name, content) {
    return nativePlugin().createTextFile({ name: requireName(name), content: String(content ?? "") });
  }
  async function renameEntry(id, name) {
    if (!String(id || "").trim()) throw new Error("ফাইলের পরিচয় পাওয়া যায়নি।");
    return nativePlugin().renameItem({ documentId: String(id), name: requireName(name) });
  }
  async function deleteEntry(id, confirmed) {
    if (confirmed !== true) throw new Error("মুছে ফেলার আগে স্পষ্ট নিশ্চিতকরণ দরকার।");
    if (!String(id || "").trim()) throw new Error("ফাইলের পরিচয় পাওয়া যায়নি।");
    return nativePlugin().deleteItem({ documentId: String(id), confirmed: true });
  }
  function organizerPlugin() {
    const plugins = root.Capacitor && root.Capacitor.Plugins;
    const plugin = plugins && plugins.AndroidMediaOrganizer;
    if (!plugin) throw new Error("Android media organizer bridge unavailable.");
    return plugin;
  }
  async function moveEntry(id, targetDirectoryId, confirmed, sourceParentId) {
    if (confirmed !== true) throw new Error("ফাইল সরানোর আগে স্পষ্ট নিশ্চিতকরণ দরকার।");
    if (!String(id || "").trim() || !String(targetDirectoryId || "").trim()) {
      throw new Error("উৎস ফাইল ও গন্তব্য ফোল্ডারের পরিচয় দরকার।");
    }
    const request = { documentId: String(id), targetDirectoryId: String(targetDirectoryId), confirmed: true };
    if (String(sourceParentId || "").trim()) request.sourceParentId = String(sourceParentId);
    return organizerPlugin().moveItem(request);
  }
  async function scanSelectedDirectoryDuplicates() {
    return nativePlugin().scanDuplicates();
  }
  async function scanExactDuplicates(files) {
    const scanner = typeof module !== "undefined" && module.exports
      ? require("./android-file-hash-scan.js") : root.MosharrofFileHashScan;
    if (!scanner) throw new Error("SHA-256 scanner module is not loaded.");
    return scanner.scanExactDuplicates(files);
  }
  const api = Object.freeze({ pickDirectory, getSelectedDirectory, listEntries, createFolder,
    createTextFile, renameEntry, deleteEntry, moveEntry, scanSelectedDirectoryDuplicates, scanExactDuplicates });
  root.MosharrofFiles = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
