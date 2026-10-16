/* MOSHARROF user-mediated Accessibility controls.
 * Every tap or coordinate swipe is initiated from this visible UI and confirmed immediately beforehand.
 * Screen labels stay on-device; this module does not send them to a model or server.
 */
(function () {
  "use strict";
  function init() {
    var nav = document.getElementById("navR");
    if (!nav || document.getElementById("mosAccessibilityAgent")) return;
    var section = document.createElement("section");
    section.className = "nav-family";
    section.id = "mosAccessibilityAgent";
    section.innerHTML =
      '<div class="nav-family-title"><span aria-hidden="true">♿</span><span>স্ক্রিন সহায়ক (Accessibility)</span></div>' +
      '<p>প্রথমে Android Settings-এ MOSHARROF AI Accessibility নিজে চালু করুন। স্ক্রিনের লেবেল এই ডিভাইসেই দেখা হবে।</p>' +
      '<div class="device-quick-actions">' +
      '<button type="button" data-access="status">সার্ভিসের অবস্থা</button>' +
      '<button type="button" data-access="inspect">বর্তমান স্ক্রিনের লেবেল দেখুন</button>' +
      '<button type="button" data-access="scroll-up">উপরে স্ক্রল</button>' +
      '<button type="button" data-access="scroll-down">নিচে স্ক্রল</button>' +
      '<button type="button" data-access="tap">লেবেল দিয়ে ট্যাপ</button>' +
      '<button type="button" data-access="swipe">স্থানাঙ্ক দিয়ে সোয়াইপ</button>' +
      '<div id="mosAccessibilityStatus" role="status" aria-live="polite">কোনো স্ক্রিন ডেটা পড়া হয়নি।</div>' +
      '<div id="mosAccessibilityLabels"></div></div>';
    nav.appendChild(section);
    var status = section.querySelector("#mosAccessibilityStatus");
    var labels = section.querySelector("#mosAccessibilityLabels");
    function plugin() {
      var p = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AndroidAccessibility;
      if (!p) throw new Error("এই সুবিধা সমর্থিত Android APK-তে উপলভ্য।");
      return p;
    }
    function showItems(items) {
      labels.textContent = "";
      (items || []).forEach(function (item) {
        if (!item || !item.label) return;
        var row = document.createElement("div");
        row.textContent = item.label + (item.clickable ? " · ক্লিকযোগ্য" : "");
        labels.appendChild(row);
      });
      if (!labels.childNodes.length) labels.textContent = "পড়ার মতো নিরাপদ লেবেল পাওয়া যায়নি।";
    }
    section.addEventListener("click", async function (event) {
      var button = event.target.closest("button[data-access]");
      if (!button) return;
      labels.textContent = "";
      try {
        var p = plugin();
        var action = button.getAttribute("data-access");
        if (action === "status") {
          var s = await p.getAccessibilityStatus();
          status.textContent = "Settings-এ চালু: " + (s.enabledInSettings ? "হ্যাঁ" : "না") +
            " · সংযুক্ত: " + (s.connected ? "হ্যাঁ" : "না") +
            " · চালু করতে ব্যবহারকারীকে Settings-এ যেতে হবে।";
        } else if (action === "inspect") {
          status.textContent = "বর্তমান স্ক্রিনের নিরাপদ লেবেল পড়া হচ্ছে…";
          var result = await p.inspectVisibleUi();
          showItems(result.items || []);
          status.textContent = "ডিভাইসেই " + (result.items || []).length + "টি লেবেল পড়া হয়েছে; কোনো স্ক্রিনশট সার্ভারে পাঠানো হয়নি।";
        } else if (action === "scroll-up" || action === "scroll-down") {
          if (!window.confirm("বর্তমান অ্যাপের স্ক্রিন স্ক্রল করবেন?")) return;
          await p.scrollVisibleUi({ forward: action === "scroll-down" });
          status.textContent = "স্ক্রল অ্যাকশন পাঠানো হয়েছে; দৃশ্যমান ফলাফল আবার পরীক্ষা করুন।";
        } else if (action === "swipe") {
          var coords = [];
          for (var promptIndex = 0; promptIndex < 4; promptIndex += 1) {
            var names = ["শুরুর X", "শুরুর Y", "শেষের X", "শেষের Y"];
            var raw = window.prompt(names[promptIndex] + " স্থানাঙ্ক (পিক্সেল)");
            if (raw === null || !raw.trim() || !/^\d+$/.test(raw.trim())) return;
            coords.push(Number(raw.trim()));
          }
          if (!window.confirm("এই স্থানাঙ্কে ৫০০ ms সোয়াইপ করবেন? সংবেদনশীল স্ক্রিনে এটি বাতিল হবে।")) return;
          var swipe = await p.swipeVisibleUi({
            startX: coords[0], startY: coords[1], endX: coords[2], endY: coords[3], durationMs: 500
          });
          status.textContent = swipe.dispatched
            ? "সোয়াইপ পাঠানো হয়েছে; স্ক্রিনের ফলাফল আলাদাভাবে যাচাই করতে হবে।"
            : "সোয়াইপ সম্পন্ন হয়নি।";
        } else if (action === "tap") {
          var label = window.prompt("স্ক্রিনে দেখা সঠিক বাটন/লেবেল লিখুন");
          if (!label || !label.trim()) return;
          if (!window.confirm('"' + label.trim() + '" লেবেলযুক্ত নিয়ন্ত্রণে ট্যাপ করবেন?')) return;
          var result = await p.tapVisibleLabel({ label: label.trim() });
          status.textContent = result.clicked ? "ট্যাপ পাঠানো হয়েছে; কাজের ফল এখনো যাচাই করা হয়নি।" : "ক্লিকযোগ্য নিয়ন্ত্রণ পাওয়া যায়নি।";
        }
      } catch (error) {
        status.textContent = error && error.message ? error.message : String(error);
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
