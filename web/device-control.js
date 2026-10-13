/* MOSHARROF Android device controls.
 * Web builds remain read-only; native controls are available only in the signed-in
 * Capacitor Android wrapper. Every action opens an Android-owned settings screen.
 */
(function () {
  "use strict";

  function initDeviceControls() {
    var nav = document.getElementById("navR");
    if (!nav || document.getElementById("mosDeviceControls")) return;

    var section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosDeviceControls";
    section.innerHTML =
      '<div class="nav-family-title"><span aria-hidden="true">▣</span><span>Android ডিভাইস নিয়ন্ত্রণ</span></div>' +
      '<div class="nav-family-items">' +
        '<button type="button" data-device-action="info"><span class="nav-icon" aria-hidden="true">ⓘ</span><span class="nav-copy"><span>ডিভাইসের তথ্য</span><small>মডেল ও Android সংস্করণ</small></span></button>' +
        '<button type="button" data-device-action="wifi"><span class="nav-icon" aria-hidden="true">⌁</span><span class="nav-copy"><span>Wi‑Fi সেটিংস</span><small>সিস্টেম সেটিংসে খুলুন</small></span></button>' +
        '<button type="button" data-device-action="bluetooth"><span class="nav-icon" aria-hidden="true">ᛒ</span><span class="nav-copy"><span>Bluetooth সেটিংস</span><small>সিস্টেম সেটিংসে খুলুন</small></span></button>' +
        '<button type="button" data-device-action="display"><span class="nav-icon" aria-hidden="true">☼</span><span class="nav-copy"><span>ডিসপ্লে</span><small>উজ্জ্বলতা ও স্ক্রিন</small></span></button>' +
        '<button type="button" data-device-action="sound"><span class="nav-icon" aria-hidden="true">♫</span><span class="nav-copy"><span>শব্দ ও রিংটোন</span><small>সাউন্ড সেটিংস</small></span></button>' +
        '<button type="button" data-device-action="battery"><span class="nav-icon" aria-hidden="true">▰</span><span class="nav-copy"><span>ব্যাটারি</span><small>ব্যাটারি সেটিংস</small></span></button>' +
        '<button type="button" data-device-action="location"><span class="nav-icon" aria-hidden="true">⌖</span><span class="nav-copy"><span>লোকেশন</span><small>লোকেশন সেটিংস</small></span></button>' +
        '<button type="button" data-device-action="apps"><span class="nav-icon" aria-hidden="true">▦</span><span class="nav-copy"><span>অ্যাপ সেটিংস</span><small>ইনস্টল করা অ্যাপ পরিচালনা</small></span></button>' +
      '</div>' +
      '<p class="device-control-note">নিরাপত্তা: পরিবর্তন করার আগে Android-এর নিজস্ব সেটিংস খুলবে। ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না।</p>';
    nav.appendChild(section);

    var methods = {
      wifi: "openWifiSettings",
      bluetooth: "openBluetoothSettings",
      display: "openDisplaySettings",
      sound: "openSoundSettings",
      battery: "openBatterySettings",
      location: "openLocationSettings",
      apps: "openAppSettings"
    };

    function notify(message) {
      var toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = message;
        toast.classList.add("show");
        window.setTimeout(function () { toast.classList.remove("show"); }, 3600);
      } else {
        window.alert(message);
      }
    }

    section.addEventListener("click", async function (event) {
      var button = event.target.closest("button[data-device-action]");
      if (!button) return;
      var action = button.getAttribute("data-device-action");
      var bridge = window.Capacitor && window.Capacitor.Plugins &&
        window.Capacitor.Plugins.DeviceControl;

      if (!bridge) {
        notify("এই নিয়ন্ত্রণের জন্য MOSHARROF-এর Android APK ইনস্টল করে খুলুন। ওয়েব ব্রাউজার সরাসরি ফোনের সেটিংস বদলাতে পারে না।");
        return;
      }

      try {
        if (action === "info") {
          var info = await bridge.getDeviceInfo();
          notify("ডিভাইস: " + (info.manufacturer || "") + " " +
            (info.model || "অজানা") + " · Android " +
            (info.androidVersion || "অজানা"));
          return;
        }
        var method = methods[action];
        if (!method || typeof bridge[method] !== "function") {
          notify("এই নিয়ন্ত্রণটি এই APK সংস্করণে উপলব্ধ নয়।");
          return;
        }
        await bridge[method]();
      } catch (error) {
        console.error("MOSHARROF device control failed", error);
        notify("সেটিংস খোলা যায়নি। Android সংস্করণে এই বিকল্পটি নাও থাকতে পারে।");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDeviceControls, { once: true });
  } else {
    initDeviceControls();
  }
})();
