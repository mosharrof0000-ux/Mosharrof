(function () {
  "use strict";
  function notify(message) {
    var toast = document.getElementById("toast");
    if (!toast) { window.alert(message); return; }
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(function () { toast.classList.remove("show"); }, 3600);
  }
  function init() {
    var nav = document.getElementById("navR");
    if (!nav || document.getElementById("mosFileManager")) return;
    var section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosFileManager";
    section.innerHTML =
      '<div class="nav-family-title"><span aria-hidden="true">▤</span><span>ফাইল ও ডুপ্লিকেট ব্যবস্থাপনা</span></div>' +
      '<div class="device-quick-actions">' +
      '<button type="button" data-fm="pick">ফোল্ডার নির্বাচন</button>' +
      '<button type="button" data-fm="list">ফাইল/ফোল্ডার দেখুন</button>' +
      '<button type="button" data-fm="folder">নতুন ফোল্ডার</button>' +
      '<button type="button" data-fm="file">নতুন টেক্সট ফাইল</button>' +
      '<button type="button" data-fm="duplicates">ডুপ্লিকেট খুঁজুন</button>' +
      '<div id="mosFileManagerStatus" role="status" aria-live="polite">শুরু করতে একটি ফোল্ডার নির্বাচন করুন।</div>' +
      '<div id="mosFileManagerResults"></div></div>';
    nav.appendChild(section);
    var status = section.querySelector("#mosFileManagerStatus");
    var results = section.querySelector("#mosFileManagerResults");
    function api() {
      var facade = window.MosharrofFiles;
      if (!facade) {
        notify("ফাইল ব্যবস্থাপনার facade লোড হয়নি। Android APK-এর script সংযোগ পরীক্ষা করুন।");
        return null;
      }
      return facade;
    }
    function showEntries(entries) {
      results.textContent = "";
      if (!entries.length) { results.textContent = "এই ফোল্ডারটি খালি।"; return; }
      entries.forEach(function (item) {
        var row = document.createElement("div");
        row.className = "device-quick-actions";
        var label = document.createElement("div");
        label.textContent = (item.isDirectory ? "📁 " : "📄 ") + item.name +
          (item.isDirectory ? "" : " · " + Number(item.size || 0) + " bytes");
        row.appendChild(label);
        var rename = document.createElement("button");
        rename.type = "button";
        rename.textContent = "নাম বদলান";
        rename.addEventListener("click", async function () {
          var name = window.prompt("নতুন নাম দিন", item.name);
          if (!name || !name.trim()) return;
          try {
            await api().renameEntry(item.documentId, name.trim());
            notify("নাম পরিবর্তন হয়েছে।");
            await refresh();
          } catch (e) { notify("নাম পরিবর্তন হয়নি: " + (e.message || e)); }
        });
        var del = document.createElement("button");
        del.type = "button";
        del.textContent = "মুছুন";
        del.addEventListener("click", async function () {
          if (!window.confirm('"' + item.name + '" মুছে ফেলবেন? এই কাজটি স্থায়ী হতে পারে।')) return;
          try {
            await api().deleteEntry(item.documentId, true);
            notify("মুছে ফেলা হয়েছে।");
            await refresh();
          } catch (e) { notify("মুছতে পারেনি: " + (e.message || e)); }
        });
        row.appendChild(rename);
        row.appendChild(del);
        results.appendChild(row);
      });
    }
    async function refresh() {
      var p = api();
      if (!p) return;
      status.textContent = "ফাইলের তালিকা পড়া হচ্ছে…";
      try {
        var r = await p.listEntries();
        status.textContent = "মোট " + (r.count || (r.items || []).length) + "টি এন্ট্রি";
        showEntries(r.items || []);
      } catch (e) { status.textContent = e.message || String(e); }
    }
    section.addEventListener("click", async function (event) {
      var button = event.target.closest("button[data-fm]");
      if (!button) return;
      var p = api();
      if (!p) return;
      try {
        var action = button.getAttribute("data-fm");
        if (action === "pick") {
          await p.pickDirectory();
          notify("ফোল্ডারের অনুমতি সংরক্ষিত হয়েছে।");
          await refresh();
        } else if (action === "list") {
          await refresh();
        } else if (action === "folder") {
          var folder = window.prompt("নতুন ফোল্ডারের নাম");
          if (!folder || !folder.trim()) return;
          await p.createFolder(folder.trim());
          notify("ফোল্ডার তৈরি হয়েছে।");
          await refresh();
        } else if (action === "file") {
          var name = window.prompt("ফাইলের নাম (যেমন notes.txt)");
          if (!name || !name.trim()) return;
          var content = window.prompt("ফাইলের লেখা", "");
          if (content === null) return;
          await p.createTextFile(name.trim(), content);
          notify("ফাইল তৈরি হয়েছে।");
          await refresh();
        } else if (action === "duplicates") {
          if (!window.confirm("নির্বাচিত ফোল্ডারের ফাইলের SHA-256 মিলিয়ে ডুপ্লিকেট খুঁজব। কোনো ফাইল মুছবে না। চালাব?")) return;
          status.textContent = "ডুপ্লিকেট স্ক্যান চলছে…";
          var scan = await p.scanSelectedDirectoryDuplicates();
          results.textContent = "";
          (scan.groups || []).forEach(function (group) {
            var card = document.createElement("div");
            card.className = "device-quick-actions";
            var heading = document.createElement("strong");
            heading.textContent = "একই কনটেন্ট: " + group.files.length + "টি ফাইল";
            card.appendChild(heading);
            group.files.forEach(function (file) {
              var line = document.createElement("div");
              line.textContent = file.name + " · " + file.size + " bytes";
              card.appendChild(line);
            });
            results.appendChild(card);
          });
          status.textContent = "স্ক্যান: " + scan.filesScanned + "টি ফাইল; " +
            scan.groups.length + "টি ডুপ্লিকেট গ্রুপ" +
            (scan.truncated ? "। সীমার কারণে স্ক্যান অসম্পূর্ণ।" : "। কোনো ফাইল মুছেনি।");
          if (!scan.groups.length) results.textContent = "স্ক্যান সীমার মধ্যে কোনো হুবহু ডুপ্লিকেট পাওয়া যায়নি।";
        }
      } catch (e) {
        status.textContent = e.message || String(e);
        notify("কাজ সম্পন্ন হয়নি; অনুমতি/ফোল্ডার যাচাই করুন।");
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
