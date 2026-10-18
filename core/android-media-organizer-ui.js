/* Small, preview-first Android photo/audio organizer UI. */
(function () {
  "use strict";
  function init() {
    var nav = document.getElementById("navR");
    if (!nav || document.getElementById("mosMediaOrganizer")) return;
    var section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosMediaOrganizer";
    section.innerHTML = '<div class="nav-family-title">ছবি ও গান সাজানো</div>' +
      '<button type="button" data-media="organize">প্রিভিউ দেখুন ও সাজান</button>' +
      '<button type="button" data-media="undo" disabled>শেষ সাজানো কাজ ফেরত</button>' +
      '<div data-media="status" role="status" aria-live="polite">আগে ফাইল ব্যবস্থাপনায় একটি ফোল্ডার নির্বাচন করুন।</div>' +
      '<pre data-media="preview"></pre>';
    nav.appendChild(section);
    var status = section.querySelector('[data-media="status"]');
    var preview = section.querySelector('[data-media="preview"]');
    var undo = section.querySelector('[data-media="undo"]');
    var movedBatch = [];
    function api() {
      if (!window.MosharrofFiles) throw new Error("Android file manager facade লোড হয়নি।");
      return window.MosharrofFiles;
    }
    function groupFor(item) {
      if (!item || item.isDirectory) return "";
      var name = String(item.name || "").toLowerCase();
      var mime = String(item.mimeType || "").toLowerCase();
      var image = mime.indexOf("image/") === 0 || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tif|tiff)$/.test(name);
      var audio = mime.indexOf("audio/") === 0 || /\.(mp3|m4a|wav|flac|ogg|aac|opus|wma)$/.test(name);
      if (!image && !audio) return "";
      var stamp = Number(item.lastModified || 0);
      var month = stamp > 0 ? new Date(stamp).getFullYear() + "-" +
        String(new Date(stamp).getMonth() + 1).padStart(2, "0") : "তারিখ-অজানা";
      return (image ? "ছবি-" : "গান-") + month;
    }
    async function organize() {
      var p = api(), selected = await p.getSelectedDirectory();
      if (!selected || !selected.documentId) throw new Error("আগে নিজের অনুমোদিত ফোল্ডার নির্বাচন করুন।");
      var listing = await p.listEntries(), groups = new Map();
      (listing.items || []).forEach(function (item) {
        var folder = groupFor(item);
        if (folder) {
          if (!groups.has(folder)) groups.set(folder, []);
          groups.get(folder).push(item);
        }
      });
      var total = Array.from(groups.values()).reduce(function (n, files) { return n + files.length; }, 0);
      if (!total) { status.textContent = "সাজানোর মতো ছবি বা অডিও ফাইল নেই।"; return; }
      if (total > 100) throw new Error("নিরাপদে একবারে সর্বোচ্চ ১০০টি ফাইল সাজানো যাবে।");
      var lines = [];
      groups.forEach(function (files, name) {
        lines.push(name + " (" + files.length + ")");
        files.forEach(function (file) { lines.push("  • " + file.name); });
      });
      preview.textContent = lines.join("\n");
      status.textContent = "প্রিভিউ: " + total + "টি ফাইল; এখনো কিছু সরানো হয়নি।";
      if (!window.confirm("প্রস্তাবিত ফোল্ডারে ফাইল সরাবেন? কোনো ফাইল মুছবে না।\n\n" + lines.join("\n"))) return;
      var folders = new Map((listing.items || []).filter(function (x) { return x.isDirectory; })
        .map(function (x) { return [x.name, x.documentId]; }));
      for (var pair of groups.entries()) {
        var name = pair[0], files = pair[1], target = folders.get(name);
        if (!target) {
          var created = await p.createFolder(name);
          target = created && created.documentId;
          if (!target) throw new Error("ফোল্ডার তৈরি হয়েছে কি না যাচাই করা যায়নি: " + name);
          folders.set(name, target);
        }
        for (var file of files) {
          var result = await p.moveEntry(file.documentId, target, true, selected.documentId);
          movedBatch.push({ id: result.documentId || file.documentId, from: target, to: selected.documentId });
          undo.disabled = false;
          status.textContent = "সাজানো চলছে: " + movedBatch.length + "/" + total;
        }
      }
      status.textContent = total + "টি ফাইল সরানো হয়েছে। চাইলে ফেরত আনুন।";
    }
    async function undoMoves() {
      var p = api();
      if (!movedBatch.length || !window.confirm("সাম্প্রতিক " + movedBatch.length + "টি ফাইল ফেরত আনবেন?")) return;
      for (var i = movedBatch.length - 1; i >= 0; i--) {
        var item = movedBatch[i];
        await p.moveEntry(item.id, item.to, true, item.from);
        movedBatch.splice(i, 1);
        undo.disabled = movedBatch.length === 0;
        status.textContent = "ফেরত আনা চলছে; বাকি " + movedBatch.length;
      }
      status.textContent = "সাম্প্রতিক সাজানো কাজ ফেরত আনা হয়েছে।";
    }
    section.addEventListener("click", async function (event) {
      var button = event.target.closest("button[data-media]");
      if (!button) return;
      button.disabled = true;
      try {
        if (button.getAttribute("data-media") === "organize") await organize();
        else await undoMoves();
      } catch (error) { status.textContent = error.message || String(error); }
      finally { button.disabled = button === undo ? movedBatch.length === 0 : false; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
