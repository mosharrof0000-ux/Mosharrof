/* Allowlisted chat/voice router for owner-confirmed Android file tasks. */
(function (root) {
  "use strict";
  function createFileCommandRouter(options = {}) {
    const planner = options.taskPlanner || root.MosharrofAndroidTaskPlanner;
    const confirm = options.confirm || (message => root.confirm(message));
    const report = options.report || (message => {
      const toast = root.document && root.document.getElementById("toast");
      if (toast) { toast.textContent = message; toast.classList.add("show"); }
    });
    function showOutput(message) {
      const status = root.document && root.document.getElementById("mosFileManagerStatus");
      const results = root.document && root.document.getElementById("mosFileManagerResults");
      if (status) status.textContent = message;
      if (results) results.textContent = message;
      report(message);
    }
    function handle(command) {
      if (!planner || typeof planner.planCommand !== "function") return { handled: false };
      const plan = planner.planCommand(command);
      if (plan.status !== "preview" || plan.steps.length !== 1) return { handled: false };
      const action = plan.steps[0].action;
      if (!["files_list", "files_create", "folder_create", "photos_group",
          "files_organize", "duplicates_scan"].includes(action)) return { handled: false };
      return { handled: true, promise: execute(action) };
    }
    async function execute(action) {
      const files = root.MosharrofFiles;
      if (!files) { showOutput("Android ফাইল ব্যবস্থাপনা APK-তে সংযুক্ত নেই।"); return { status: "unavailable" }; }
      try {
        if (action === "photos_group" || action === "files_organize") {
          const button = root.document && root.document.querySelector('#mosMediaOrganizer [data-media="organize"]');
          if (!button) { showOutput("ছবি/গান সাজানোর UI প্রস্তুত নয়; ফাইল ব্যবস্থাপনা প্যানেল খুলুন।"); return { status: "unavailable" }; }
          button.click();
          report("ছবি/গান সাজানোর preview খুলেছি; ফাইল সরানোর আগে নিশ্চিতকরণ দিতে হবে।");
          return { status: "preview_opened" };
        }
        await files.getSelectedDirectory();
        if (action === "files_list") {
          const listing = await files.listEntries(), items = listing.items || [];
          const lines = items.slice(0, 50).map(item => (item.isDirectory ? "📁 " : "📄 ") + item.name);
          if (items.length > 50) lines.push("… আরও " + (items.length - 50) + "টি");
          showOutput(lines.join("\n") || "নির্বাচিত ফোল্ডারটি খালি।");
          return { status: "completed", count: items.length };
        }
        if (action === "folder_create") {
          const name = root.prompt("নতুন ফোল্ডারের নাম");
          if (!name || !name.trim()) return { status: "cancelled" };
          if (!confirm('"' + name.trim() + '" ফোল্ডার তৈরি করবেন?')) return { status: "cancelled" };
          const result = await files.createFolder(name.trim());
          showOutput("ফোল্ডার তৈরির অনুরোধ সম্পন্ন হয়েছে: " + name.trim());
          return { status: "completed", result };
        }
        if (action === "files_create") {
          const name = root.prompt("নতুন ফাইলের নাম (যেমন notes.txt)");
          if (!name || !name.trim()) return { status: "cancelled" };
          const body = root.prompt("ফাইলের লেখা", "");
          if (body === null) return { status: "cancelled" };
          if (!confirm('"' + name.trim() + '" ফাইল তৈরি করবেন?')) return { status: "cancelled" };
          const result = await files.createTextFile(name.trim(), body);
          showOutput("ফাইল তৈরির অনুরোধ সম্পন্ন হয়েছে: " + name.trim());
          return { status: "completed", result };
        }
        if (action === "duplicates_scan") {
          if (!confirm("নির্বাচিত ফোল্ডারে SHA-256 ডুপ্লিকেট স্ক্যান করবেন? কোনো ফাইল মুছবে না।")) return { status: "cancelled" };
          const scan = await files.scanSelectedDirectoryDuplicates(), groups = scan.groups || [];
          const lines = groups.map(group => "একই কনটেন্ট (" + group.files.length + "টি): " +
            group.files.map(file => file.name).join(", "));
          lines.unshift("স্ক্যান: " + scan.filesScanned + "টি ফাইল; " + groups.length + "টি ডুপ্লিকেট গ্রুপ।");
          lines.push("কোনো ফাইল মুছেনি।");
          if (scan.truncated) lines.push("সীমার কারণে স্ক্যান অসম্পূর্ণ।");
          showOutput(lines.join("\n"));
          return { status: "completed", scanned: scan.filesScanned, groups: groups.length };
        }
      } catch (error) {
        showOutput("কাজ সম্পন্ন হয়নি: " + String(error && error.message || error));
        return { status: "failed", reason: String(error && error.message || error) };
      }
      return { status: "unavailable" };
    }
    return Object.freeze({ handle });
  }
  const api = Object.freeze({ createFileCommandRouter });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MosharrofAndroidFileCommandRouter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
