/* MOSHARROF Android settings hub.
 * Native actions only open Android-owned settings screens; the user confirms changes there.
 */
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
    { title: "সংযোগ", items: [
      ["wifi", "Wi‑Fi", "Wi‑Fi নেটওয়ার্ক সেটিংস"],
      ["bluetooth", "Bluetooth", "ডিভাইস জোড়া ও সংযোগ"],
      ["vpn", "VPN", "VPN সংযোগ ও প্রোফাইল"],
      ["nfc", "NFC", "NFC ও কাছাকাছি সংযোগ"]
    ]},
    { title: "ডিভাইস", items: [
      ["info", "ডিভাইসের তথ্য", "মডেল ও Android সংস্করণ"],
      ["display", "ডিসপ্লে", "উজ্জ্বলতা, স্ক্রিন ও টাইমআউট"],
      ["sound", "শব্দ ও রিংটোন", "ভলিউম ও সাউন্ড সেটিংস"],
      ["battery", "ব্যাটারি", "ব্যাটারি ও পাওয়ার সেটিংস"],
      ["storage", "স্টোরেজ", "স্টোরেজ ব্যবস্থাপনা"],
      ["batteryOptimization", "ব্যাটারি অপ্টিমাইজেশন", "অ্যাপের ব্যাকগ্রাউন্ড সীমা"]
    ]},
    { title: "গোপনীয়তা ও নিরাপত্তা", items: [
      ["location", "লোকেশন", "লোকেশন চালু ও অনুমতি"],
      ["privacy", "গোপনীয়তা", "Privacy ও অনুমতি নিয়ন্ত্রণ"],
      ["security", "নিরাপত্তা", "স্ক্রিন লক ও নিরাপত্তা"],
      ["notifications", "নোটিফিকেশন", "নোটিফিকেশন সেটিংস"],
      ["accessibility", "Accessibility", "সহায়ক প্রযুক্তি—নিজে পর্যালোচনা করে চালু করুন"],
      ["overlay", "অন্য অ্যাপের ওপর দেখানো", "MOSHARROF-এর Overlay বিশেষ অনুমতি"],
      ["appDetails", "MOSHARROF অ্যাপের অনুমতি", "এই অ্যাপের Android App Info"]
    ]},
    { title: "সিস্টেম ও অ্যাপ", items: [
      ["apps", "ইনস্টল করা অ্যাপ", "অ্যাপ ম্যানেজমেন্ট"],
      ["defaultApps", "ডিফল্ট অ্যাপ", "ডিফল্ট ব্রাউজার, ফোন ও অন্যান্য অ্যাপ"],
      ["dateTime", "তারিখ ও সময়", "সময় অঞ্চল ও ঘড়ি"],
      ["language", "ভাষা", "ভাষা ও অঞ্চল"],
      ["keyboard", "কীবোর্ড ও ইনপুট", "কীবোর্ড ও ইনপুট পদ্ধতি"],
      ["accounts", "অ্যাকাউন্ট ও সিঙ্ক", "অ্যাকাউন্ট সিঙ্ক সেটিংস"]
    ]}
  ];

  var methods = {
    wifi: "openWifiSettings",
    bluetooth: "openBluetoothSettings",
    vpn: "openVpnSettings",
    nfc: "openNfcSettings",
    display: "openDisplaySettings",
    sound: "openSoundSettings",
    battery: "openBatterySettings",
    storage: "openStorageSettings",
    batteryOptimization: "openBatteryOptimizationSettings",
    location: "openLocationSettings",
    privacy: "openPrivacySettings",
    security: "openSecuritySettings",
    notifications: "openNotificationSettings",
    accessibility: "openAccessibilitySettings",
    overlay: "openOverlayPermissionSettings",
    appDetails: "openAppDetailsSettings",
    apps: "openAppSettings",
    defaultApps: "openDefaultAppsSettings",
    dateTime: "openDateTimeSettings",
    language: "openLanguageSettings",
    keyboard: "openKeyboardSettings",
    accounts: "openAccountsSettings"
  };

  function init() {
    var nav = document.getElementById("navR");
    if (!nav || document.getElementById("mosDeviceControls")) return;
    var section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosDeviceControls";
    var html = '<div class="nav-family-title"><span aria-hidden="true">▣</span><span>Android ডিভাইস নিয়ন্ত্রণ</span></div>';
    html += '<p class="device-control-note">নিরাপদ নিয়ন্ত্রণ: MOSHARROF প্রাসঙ্গিক Android সেটিংস খুলবে। সিস্টেম পরিবর্তনের আগে Android আপনার অনুমতি চাইতে পারে।</p>';
    groups.forEach(function (group) {
      html += '<div class="device-control-group"><div class="device-control-group-title">' + group.title + '</div><div class="nav-family-items">';
      group.items.forEach(function (item) {
        html += '<button type="button" data-device-action="' + item[0] + '"><span class="nav-icon" aria-hidden="true">⚙</span><span class="nav-copy"><span>' + item[1] + '</span><small>' + item[2] + '</small></span></button>';
      });
      html += '</div></div>';
    });
    section.innerHTML = html;
    nav.appendChild(section);

    section.addEventListener("click", async function (event) {
      var button = event.target.closest("button[data-device-action]");
      if (!button) return;
      var action = button.getAttribute("data-device-action");
      var bridge = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DeviceControl;
      if (!bridge) {
        notify("ওয়েবসাইট একা ফোনের সিস্টেম সেটিংস নিয়ন্ত্রণ করতে পারে না। এই সুবিধার জন্য MOSHARROF Android APK ব্যবহার করুন।");
        return;
      }
      button.disabled = true;
      try {
        if (action === "info") {
          var info = await bridge.getDeviceInfo();
          notify([info.manufacturer, info.model, "Android " + info.androidVersion].filter(Boolean).join(" · "));
          return;
        }
        var method = methods[action];
        if (!method || typeof bridge[method] !== "function") {
          notify("এই সুবিধাটি APK-তে নেই। আপডেটেড APK তৈরি ও ইনস্টল করতে হবে।");
          return;
        }
        var result = await bridge[method]();
        if (result && result.opened) notify("Android সেটিংস খোলা হয়েছে। পরিবর্তনটি Android-এর স্ক্রিনে সম্পন্ন করুন।");
      } catch (error) {
        notify("সেটিংস খোলা যায়নি: " + String(error && error.message || error));
      } finally {
        button.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
