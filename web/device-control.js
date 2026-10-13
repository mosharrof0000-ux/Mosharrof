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
        '<button type="button" data-device-action="bubble-on"><span class="nav-icon" aria-hidden="true">🎙</span><span class="nav-copy"><span>ভাসমান ভয়েস বাটন চালু</span><small>অন্য অ্যাপেও পাশে থাকবে</small></span></button>' +
        '<button type="button" data-device-action="bubble-off"><span class="nav-icon" aria-hidden="true">⊖</span><span class="nav-copy"><span>ভাসমান বাটন বন্ধ</span><small>ফোনের স্ক্রিন থেকে সরান</small></span></button>' +
        '<button type="button" data-device-action="tile-help"><span class="nav-icon" aria-hidden="true">▤</span><span class="nav-copy"><span>Quick Settings</span><small>ওপর থেকে নামিয়ে MOSHARROF যোগ করুন</small></span></button>' +
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

    var pendingBubblePermission = false;
    var resumeCheckBusy = false;
    var resumeCheckTimer = null;

    function getBridge() {
      return window.Capacitor && window.Capacitor.Plugins &&
        window.Capacitor.Plugins.DeviceControl;
    }

    async function resumeBubbleAfterPermission() {
      if (!pendingBubblePermission || resumeCheckBusy || document.visibilityState === "hidden") return;
      var bridge = getBridge();
      if (!bridge || typeof bridge.getFloatingBubbleStatus !== "function") return;
      resumeCheckBusy = true;
      try {
        var status = await bridge.getFloatingBubbleStatus();
        if (status && status.overlayPermission) {
          pendingBubblePermission = false;
          var result = await bridge.enableFloatingBubble();
          notify(result && result.enabled
            ? "অনুমতি পাওয়া গেছে—ভাসমান MOSHARROF বাটন চালু হয়েছে। এখন হোমস্ক্রিনে বা অন্য অ্যাপে যান।"
            : "অনুমতি পাওয়া গেছে, কিন্তু ভাসমান বাটন চালু হয়নি। আবার চেষ্টা করুন।");
        } else {
          pendingBubblePermission = false;
          notify("ভাসমান বাটন চালু হয়নি। Android সেটিংসে MOSHARROF-এর 'অন্য অ্যাপের ওপর দেখান' অনুমতি চালু করে আবার চেষ্টা করুন।");
        }
      } catch (error) {
        pendingBubblePermission = false;
        console.error("MOSHARROF overlay resume failed", error);
        notify("অনুমতি যাচাই করা যায়নি। ডান মেনু থেকে ভাসমান বাটন আবার চালু করুন।");
      } finally {
        resumeCheckBusy = false;
      }
    }

    function scheduleBubblePermissionCheck() {
      if (!pendingBubblePermission) return;
      if (resumeCheckTimer) window.clearTimeout(resumeCheckTimer);
      resumeCheckTimer = window.setTimeout(resumeBubbleAfterPermission, 700);
    }
    document.addEventListener("visibilitychange", scheduleBubblePermissionCheck);
    window.addEventListener("focus", scheduleBubblePermissionCheck);
    window.addEventListener("pageshow", scheduleBubblePermissionCheck);

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
      var bridge = getBridge();

      if (action === "tile-help") {
        notify("Android-এর ওপর থেকে দুবার নামান → সম্পাদনা/পেন্সিল চাপুন → MOSHARROF AI টাইলটি টেনে যোগ করুন। টাইলটি শুধু MOSHARROF APK-তে থাকবে।");
        return;
      }
      if (!bridge) {
        notify("ফোনজুড়ে ভাসমান বাটন ও Quick Settings-এর জন্য MOSHARROF Android APK প্রয়োজন। ওয়েবসাইটের পাশের ছোট বাটনটি এখানেই কাজ করবে।");
        return;
      }

      try {
        if (action === "bubble-on") {
          var enabled = await bridge.enableFloatingBubble();
          if (enabled && enabled.permissionRequired) {
            pendingBubblePermission = true;
            notify("Android-এর 'অন্য অ্যাপের ওপর দেখানোর অনুমতি' পৃষ্ঠা খুলেছে। অনুমতি চালু করে MOSHARROF-এ ফিরুন—বাটনটি স্বয়ংক্রিয়ভাবে চালু হবে।");
          } else if (enabled && enabled.enabled) {
            pendingBubblePermission = false;
            notify("MOSHARROF ভাসমান ভয়েস বাটন চালু হয়েছে। এখন হোমস্ক্রিনে বা অন্য অ্যাপে যান।");
          } else {
            notify("ভাসমান বাটন চালু হয়নি। Android-এর overlay অনুমতি ও বিজ্ঞপ্তির অনুমতি পরীক্ষা করুন।");
          }
          return;
        }
        if (action === "bubble-off") {
          pendingBubblePermission = false;
          await bridge.disableFloatingBubble();
          notify("MOSHARROF ভাসমান বাটন বন্ধ করা হয়েছে।");
          return;
        }
        if (action === "info") {
          var info = await bridge.getDeviceInfo();
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
