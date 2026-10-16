/* Android-only SAF file manager UI. The owner chooses the exact folder via Android's system picker. */
(function () {
  "use strict";
  const key = "mosharrof-user-files-tree-uri";
  let treeUri = null;
  let entries = [];
  let selected = null;
  function notify(message) {
    const toast = document.getElementById("toast");
    if (toast) { toast.textContent = message; toast.classList.add("show"); window.setTimeout(() => toast.classList.remove("show"), 3600); }
    else window.alert(message);
  }
  function plugin() {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.UserFiles;
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function render() {
    const list = document.getElementById("mosUserFilesList");
    const status = document.getElementById("mosUserFilesStatus");
    if (!list || !status) return;
    status.textContent = treeUri ? "নির্বাচিত ফোল্ডারের অনুমতি সক্রিয়" : "প্রথমে Android থেকে একটি ফোল্ডার নির্বাচন করুন";
    list.innerHTML = entries.length ? entries.map((entry, index) =>
      '<button type="button" class="mos-user-file-row" data-file-index="' + index + '">' +
      '<span aria-hidden="true">' + (entry.isDirectory ? "📁" : "📄") + '</span> ' +
      escapeHtml(entry.name || "(নামহীন)") + (entry.isDirectory ? " /" : "") +
      '</button>').join("") : '<p>এখানে এখনো কোনো তালিকা নেই। ফোল্ডার নির্বাচন করে “তালিকা দেখুন” চাপুন।</p>';
    const chosen = document.getElementById("mosUserFilesSelected");
    if (chosen) chosen.textContent = selected ? "নির্বাচিত: " + selected.name : "কোনো ফাইল নির্বাচন করা হয়নি";
  }
  async function run(action) {
    const p = plugin();
    if (!p) { notify("এই সুবিধার জন্য আপডেটেড Android APK দরকার।"); return; }
    try {
      if (action === "pick") {
        const result = await p.pickFolder();
        treeUri = result.treeUri; entries = []; selected = null;
        notify("ফোল্ডারের অনুমতি পাওয়া গেছে। এখন তালিকা দেখুন।"); render(); return;
      }
      if (!treeUri) { notify("আগে একটি ফোল্ডার নির্বাচন করুন।"); return; }
      if (action === "list") {
        const result = await p.listEntries({ treeUri });
        entries = result.entries || []; selected = null; render();
        notify(entries.length + "টি আইটেম পাওয়া গেছে।"); return;
      }
      if (action === "folder") {
        const name = window.prompt("নতুন ফোল্ডারের নাম লিখুন");
        if (name == null) return;
        await p.createFolder({ treeUri, name });
        notify("ফোল্ডার তৈরি হয়েছে।"); return run("list");
      }
      if (action === "file") {
        const name = window.prompt("নতুন টেক্সট ফাইলের নাম লিখুন", "নতুন-ফাইল.txt");
        if (name == null) return;
        const content = window.prompt("ফাইলের বিষয়বস্তু লিখুন", "");
        if (content == null) return;
        await p.createTextFile({ treeUri, name, content });
        notify("ফাইল তৈরি হয়েছে।"); return run("list");
      }
      if (action === "rename") {
        if (!selected) { notify("আগে তালিকা থেকে একটি ফাইল বা ফোল্ডার নির্বাচন করুন।"); return; }
        const newName = window.prompt("নতুন নাম লিখুন", selected.name);
        if (newName == null || newName.trim() === selected.name) return;
        await p.renameEntry({ treeUri, uri: selected.uri, newName });
        notify("নাম পরিবর্তন হয়েছে।"); return run("list");
      }
      if (action === "delete") {
        if (!selected) { notify("আগে তালিকা থেকে একটি ফাইল বা ফোল্ডার নির্বাচন করুন।"); return; }
        if (!window.confirm('"' + selected.name + '" মুছে ফেলবেন? এই কাজটি সব ফাইল-প্রদানকারীতে ফেরানো নাও যেতে পারে।')) return;
        await p.deleteEntry({ treeUri, uri: selected.uri, confirmed: true });
        selected = null; notify("মুছে ফেলার অনুরোধ সম্পন্ন হয়েছে।"); return run("list");
      }
    } catch (error) {
      notify("ফাইলের কাজ ব্যর্থ: " + String(error && error.message || error));
    }
  }
  function init() {
    const nav = document.getElementById("navR");
    if (!nav || document.getElementById("mosUserFiles")) return;
    const section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosUserFiles";
    section.innerHTML = '<div class="nav-family-title"><span aria-hidden="true">📂</span><span>ফাইল ও ফোল্ডার</span></div>' +
      '<p>শুধু আপনার নির্বাচিত ফোল্ডারে কাজ হবে। স্থায়ী ডিলিটের আগে নিশ্চিতকরণ চাওয়া হবে।</p>' +
      '<div class="nav-family-items">' +
      '<button type="button" data-user-file-action="pick">ফোল্ডার নির্বাচন</button>' +
      '<button type="button" data-user-file-action="list">তালিকা দেখুন</button>' +
      '<button type="button" data-user-file-action="folder">ফোল্ডার তৈরি</button>' +
      '<button type="button" data-user-file-action="file">টেক্সট ফাইল তৈরি</button>' +
      '<button type="button" data-user-file-action="rename">নাম পরিবর্তন</button>' +
      '<button type="button" data-user-file-action="delete">নির্বাচিত আইটেম মুছুন</button></div>' +
      '<p id="mosUserFilesStatus" role="status" aria-live="polite"></p>' +
      '<p id="mosUserFilesSelected">কোনো ফাইল নির্বাচন করা হয়নি</p>' +
      '<div id="mosUserFilesList" class="mos-user-files-list"></div>';
    nav.appendChild(section);
    section.addEventListener("click", event => {
      const actionButton = event.target.closest("[data-user-file-action]");
      if (actionButton) { run(actionButton.getAttribute("data-user-file-action")); return; }
      const row = event.target.closest("[data-file-index]");
      if (row) { selected = entries[Number(row.getAttribute("data-file-index"))] || null; render(); }
    });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
