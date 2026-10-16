/* MOSHARROF Android device controls.
 * This UI only opens Android-owned settings screens; it never silently changes system state.
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

  function init() {
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
        '<button type="button" data-device-action="apps"><span class="nav-icon" aria-hidden="true">▦</span><span class="nav-copy"><span>অ্যাপ সেটিংস</span><small>অ্যান্ড্রয়েডের অ্যাপ সেটিংস খুলুন</small></span></button>' +
      '</div>';
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
    section.addEventListener("click", async function (event) {
      var button = event.target.closest("button[data-device-action]");
      if (!button) return;
      var action = button.getAttribute("data-device-action");
      var bridge = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DeviceControl;
      if (!bridge) {
        notify("ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না। এই সুবিধার জন্য MOSHARROF Android APK ব্যবহার করুন।");
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
          notify("এই ডিভাইসে সুবিধাটি পাওয়া যাচ্ছে না।");
          return;
        }
        await bridge[method]();
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
