/* MOSHARROF Android settings hub. Settings changes remain user-mediated. */
(function () {
  "use strict";
  function notify(message) {
    var toast = document.getElementById("toast");
    if (!toast) { window.alert(message); return; }
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(function () { toast.classList.remove("show"); }, 3600);
  }
  var groups = [
    ["সংযোগ", [["wifi","Wi‑Fi"],["bluetooth","Bluetooth"],["vpn","VPN"],["nfc","NFC"]]],
    ["ডিভাইস", [["info","ডিভাইসের তথ্য"],["display","ডিসপ্লে"],["sound","শব্দ ও রিংটোন"],["battery","ব্যাটারি"],["storage","স্টোরেজ"],["batteryOptimization","ব্যাটারি অপ্টিমাইজেশন"]]],
    ["গোপনীয়তা ও নিরাপত্তা", [["location","লোকেশন"],["privacy","গোপনীয়তা"],["security","নিরাপত্তা"],["notifications","নোটিফিকেশন"],["accessibility","Accessibility"],["overlay","অন্য অ্যাপের ওপর দেখানো"],["appDetails","MOSHARROF অ্যাপের অনুমতি"]]],
    ["সিস্টেম ও অ্যাপ", [["apps","ইনস্টল করা অ্যাপ"],["defaultApps","ডিফল্ট অ্যাপ"],["dateTime","তারিখ ও সময়"],["language","ভাষা"],["keyboard","কীবোর্ড ও ইনপুট"],["accounts","অ্যাকাউন্ট ও সিঙ্ক"]]]
  ];
  var methods = {wifi:"openWifiSettings",bluetooth:"openBluetoothSettings",vpn:"openVpnSettings",nfc:"openNfcSettings",display:"openDisplaySettings",sound:"openSoundSettings",battery:"openBatterySettings",storage:"openStorageSettings",batteryOptimization:"openBatteryOptimizationSettings",location:"openLocationSettings",privacy:"openPrivacySettings",security:"openSecuritySettings",notifications:"openNotificationSettings",accessibility:"openAccessibilitySettings",overlay:"openOverlayPermissionSettings",appDetails:"openAppDetailsSettings",apps:"openAppSettings",defaultApps:"openDefaultAppsSettings",dateTime:"openDateTimeSettings",language:"openLanguageSettings",keyboard:"openKeyboardSettings",accounts:"openAccountsSettings"};
  function bridge() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DeviceControl; }
  function init() {
    var nav = document.getElementById("navR");
    if (!nav || document.getElementById("mosDeviceControls")) return;
    var section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosDeviceControls";
    var html = '<div class="nav-family-title"><span aria-hidden="true">▣</span><span>Android ডিভাইস নিয়ন্ত্রণ</span></div><p>Android সেটিংস খুলবে; পরিবর্তন আপনাকে সেখানে নিশ্চিত করতে হবে।</p><button type="button" data-device-action="selfTest">সব নিয়ন্ত্রণের সংযোগ পরীক্ষা</button><p id="deviceControlDiagnostic" role="status" aria-live="polite" hidden></p>';
    groups.forEach(function (group) {
      html += '<div class="device-control-group"><div class="device-control-group-title">' + group[0] + '</div><div class="nav-family-items">';
      group[1].forEach(function (item) { html += '<button type="button" data-device-action="' + item[0] + '"><span class="nav-icon" aria-hidden="true">⚙</span><span class="nav-copy"><span>' + item[1] + '</span></span></button>'; });
      html += '</div></div>';
    });
    section.innerHTML = html;
    nav.appendChild(section);
    section.addEventListener("click", async function (event) {
      var button = event.target.closest("button[data-device-action]");
      if (!button) return;
      var action = button.getAttribute("data-device-action"), plugin = bridge();
      if (action === "selfTest") {
        var missing = [];
        if (!plugin || typeof plugin.getDeviceInfo !== "function") missing.push("ডিভাইসের তথ্য");
        Object.keys(methods).forEach(function (key) { if (!plugin || typeof plugin[methods[key]] !== "function") missing.push(key); });
        var diagnostic = section.querySelector("#deviceControlDiagnostic");
        diagnostic.hidden = false;
        diagnostic.textContent = missing.length ? "FAIL — সংযোগ নেই: " + missing.join(", ") : "PASS — ২২টি সেটিংস অ্যাকশন ও ডিভাইস-তথ্য API সংযুক্ত। এটি সংযোগ পরীক্ষা; প্রতিটি স্ক্রিন ফোনে খুলে দেখা হয়েছে—এমন প্রমাণ নয়।";
        notify(missing.length ? "ডিভাইস নিয়ন্ত্রণ সংযোগে সমস্যা পাওয়া গেছে।" : "সংযোগ পরীক্ষা PASS; বাস্তব স্ক্রিন পরীক্ষা আলাদা।");
        return;
      }
      if (!plugin) { notify("ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না। Android APK ব্যবহার করুন।"); return; }
      button.disabled = true;
      try {
        if (action === "info") {
          var info = await plugin.getDeviceInfo();
          notify([info.manufacturer, info.model, "Android " + info.androidVersion].filter(Boolean).join(" · "));
          return;
        }
        var method = methods[action];
        if (!method || typeof plugin[method] !== "function") { notify("এই সুবিধাটি APK-তে নেই; আপডেটেড APK দরকার।"); return; }
        var result = await plugin[method]();
        if (result && result.opened) notify("Android সেটিংস খোলা হয়েছে। পরিবর্তনটি সিস্টেমের স্ক্রিনে করুন।");
      } catch (error) {
        notify("সেটিংস খোলা যায়নি: " + String(error && error.message || error));
      } finally { button.disabled = false; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();