/* MOSHARROF AI — explicit-consent Android device actions.
 * Commands are only proposals until the user presses "অনুমতি দিন".
 * The native bridge never performs a call/message send; it opens a user-facing
 * system flow and reports only what the platform confirms.
 */
(function () {
  "use strict";

  var SETTINGS = {
    "সাধারণ": "general", "general": "general", "ওয়াইফাই": "wifi", "ওয়াইফাই": "wifi",
    "wifi": "wifi", "wi-fi": "wifi", "ব্লুটুথ": "bluetooth", "bluetooth": "bluetooth",
    "ডিসপ্লে": "display", "display": "display", "শব্দ": "sound", "sound": "sound",
    "ব্যাটারি": "battery", "battery": "battery", "অ্যাপ": "apps", "apps": "apps",
    "অনুমতি": "permissions", "permissions": "permissions", "লোকেশন": "location",
    "location": "location"
  };

  function clean(value) {
    return String(value || "").trim().replace(/[।.!?؟]+$/g, "").trim();
  }

  function parse(text) {
    var value = clean(text);
    var lower = value.toLocaleLowerCase();

    var settingMatch = lower.match(/(?:সেটিংস|settings)\s*(?:খোলো|খুলুন|open)?(?:\s+(সাধারণ|ওয়াইফাই|ওয়াইফাই|wifi|wi-fi|ব্লুটুথ|bluetooth|ডিসপ্লে|display|শব্দ|sound|ব্যাটারি|battery|অ্যাপ|apps|অনুমতি|permissions|লোকেশন|location))?/i);
    var prefixPageMatch = lower.match(/(সাধারণ|ওয়াইফাই|ওয়াইফাই|wifi|wi-fi|ব্লুটুথ|bluetooth|ডিসপ্লে|display|শব্দ|sound|ব্যাটারি|battery|অ্যাপ|apps|অনুমতি|permissions|লোকেশন|location)\s+(?:সেটিংস|settings)/i);
    if (settingMatch) {
      var settingKey = String((prefixPageMatch && prefixPageMatch[1]) || settingMatch[1] || "সাধারণ").toLocaleLowerCase();
      var page = SETTINGS[settingKey] || "general";
      return {kind:"settings", title:"Android সেটিংস খুলুন", detail:"পৃষ্ঠা: " + page, payload:{page:page},
        summary:"মোশাররফ Android-এর " + page + " সেটিংস খোলার অনুমতি চাইছে। কোনো সেটিং নিজে থেকে বদলাবে না।"};
    }

    if (/(স্টোরেজ|মেমোরি|র‍্যাম|ram|storage|memory).*(কত|দেখাও|দেখুন|পরীক্ষা|status|check|show)?/i.test(lower)) {
      return {kind:"diagnostics",title:"ডিভাইসের উপলভ্য স্টোরেজ ও মেমোরি দেখুন",
        detail:"শুধু Android-এর প্রকাশ্য সিস্টেম মেট্রিক",payload:{},
        summary:"মোশাররফ উপলভ্য স্টোরেজ ও মেমোরির মেট্রিক পড়তে অনুমতি চাইছে। অন্য অ্যাপের ব্যক্তিগত ডেটা পড়বে না।"};
    }

    var dialMatch = value.match(/(?:কল|ফোন|ডায়াল|ডায়াল|call|dial)\s*(?:করো|করুন|দাও|দিন|করতে)?\s*(?:নম্বর\s*)?([+\d][\d\s().-]{5,20})$/i);
    if (dialMatch) {
      var number = dialMatch[1].replace(/[\s().-]/g, "");
      if (/^\+?\d{6,16}$/.test(number)) return {kind:"dial",title:"ফোন ডায়ালার খুলুন",
        detail:"নম্বর: " + number,payload:{number:number},
        summary:"মোশাররফ " + number + " নম্বরটি Android ডায়ালারে প্রস্তুত করতে অনুমতি চাইছে। নিজে থেকে কল করবে না।"};
    }

    var smsMatch = value.match(/(?:মেসেজ|এসএমএস|sms|message)\s*(?:লিখো|লিখুন|তৈরি|draft)?\s*(?:করো|করুন)?\s+([+\d][\d\s().-]{5,20})\s*[:：-]\s*(.+)$/i);
    if (smsMatch) {
      var recipient = smsMatch[1].replace(/[\s().-]/g, "");
      var body = smsMatch[2].trim();
      if (/^\+?\d{6,16}$/.test(recipient) && body) return {kind:"sms",title:"SMS খসড়া তৈরি করুন",
        detail:"প্রাপক: " + recipient + " · পাঠানোর আগে মেসেজটি আপনি যাচাই করবেন",
        payload:{recipient:recipient,body:body},
        summary:"মোশাররফ " + recipient + " নম্বরে একটি SMS খসড়া খুলতে অনুমতি চাইছে। বার্তা পাঠাবে না।"};
    }

    var emailMatch = value.match(/(?:ইমেইল|email)\s*(?:লিখো|লিখুন|draft|তৈরি)?\s+([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})\s*[:：-]\s*(.+)$/i);
    if (emailMatch) return {kind:"email",title:"ইমেইল খসড়া তৈরি করুন",
      detail:"প্রাপক: " + emailMatch[1],payload:{recipient:emailMatch[1],body:emailMatch[2].trim()},
      summary:"মোশাররফ ইমেইল অ্যাপে খসড়া খুলতে অনুমতি চাইছে। ইমেইল পাঠাবে না।"};

    var appMatch = value.match(/(?:অ্যাপ|app)\s*(?:খোলো|খুলুন|open)\s+([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+){1,})$/i);
    if (appMatch) return {kind:"launch",title:"নির্দিষ্ট অ্যাপ খুলুন",
      detail:"প্যাকেজ: " + appMatch[1],payload:{packageName:appMatch[1]},
      summary:"মোশাররফ " + appMatch[1] + " অ্যাপটি খুলতে অনুমতি চাইছে। অ্যাপের ভেতরে কোনো কাজ করবে না।"};

    if (/(ফাইল|file).*(বাছাই|নির্বাচন|pick|choose|খোলো|open)/i.test(lower)) {
      return {kind:"file",title:"আপনার বেছে দেওয়া ফাইল খুলুন",
        detail:"Android-এর system file picker ব্যবহার হবে",payload:{},
        summary:"মোশাররফ শুধু আপনার নির্বাচিত ফাইলের URI পেতে অনুমতি চাইছে। পুরো স্টোরেজ স্ক্যান করবে না।"};
    }
    return null;
  }

  function getPlugin() {
    return window.Capacitor && window.Capacitor.Plugins &&
      window.Capacitor.Plugins.MosharrofDeviceControl || null;
  }

  function run(action) {
    var plugin = getPlugin();
    if (!plugin) return Promise.reject(new Error("এই কাজের জন্য Android অ্যাপের native bridge দরকার। ব্রাউজার সংস্করণে কাজটি চালানো হয়নি।"));
    var methods = {
      settings: function () { return plugin.openSettings({page:action.payload.page}); },
      diagnostics: function () { return plugin.getDiagnostics({}); },
      dial: function () { return plugin.openDialer({number:action.payload.number}); },
      sms: function () { return plugin.draftSms(action.payload); },
      email: function () { return plugin.draftEmail(action.payload); },
      launch: function () { return plugin.launchApp(action.payload); },
      file: function () { return plugin.pickFile({}); }
    };
    if (!methods[action.kind]) return Promise.reject(new Error("এই কাজটি এখনো সমর্থিত নয়।"));
    return Promise.resolve().then(methods[action.kind]);
  }

  function request(action, onResult) {
    var host = document.getElementById("messages") || document.body;
    var card = document.createElement("section");
    card.className = "device-approval-card";
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", "ডিভাইস কাজের অনুমতি");
    var heading = document.createElement("strong");
    heading.textContent = action.title;
    var description = document.createElement("p");
    description.textContent = action.summary;
    var details = document.createElement("p");
    details.className = "device-approval-detail";
    details.textContent = action.detail;
    var approve = document.createElement("button");
    approve.type = "button"; approve.textContent = "অনুমতি দিন";
    var cancel = document.createElement("button");
    cancel.type = "button"; cancel.textContent = "বাতিল";
    cancel.className = "device-cancel";
    var status = document.createElement("p");
    status.className = "device-action-status";
    status.setAttribute("aria-live", "polite");
    var buttons = document.createElement("div");
    buttons.className = "device-approval-buttons";
    buttons.append(approve, cancel);
    card.append(heading, description, details, buttons, status);
    host.appendChild(card);
    card.scrollIntoView({behavior:"smooth",block:"nearest"});
    function finish(message) {
      approve.disabled = true; cancel.disabled = true;
      status.textContent = message;
      if (typeof onResult === "function") onResult(message);
    }
    cancel.addEventListener("click", function () { finish("আপনি কাজটি বাতিল করেছেন। কোনো ডিভাইস কাজ চালানো হয়নি।"); });
    approve.addEventListener("click", function () {
      approve.disabled = true; cancel.disabled = true;
      status.textContent = "অনুমোদন গৃহীত—Android ফলাফল যাচাই হচ্ছে…";
      run(action).then(function (result) {
        var statusCode = result && (result.status || result.state);
        if (action.kind === "diagnostics" && result) {
          var storage = result.storage || {};
          var memory = result.memory || {};
          finish("যাচাইকৃত সিস্টেম রিপোর্ট: উপলভ্য স্টোরেজ " +
            (storage.availableHuman || "অজানা") + "; উপলভ্য RAM " +
            (memory.availableHuman || "অজানা") + ". উৎস: Android System API.");
        } else if (action.kind === "file" && result && result.uri) {
          finish("ফাইল পিকার থেকে একটি ফাইল নির্বাচিত হয়েছে। URI অনুমতি Android দিয়েছে; ফাইলের বিষয়বস্তু পড়া হয়নি।");
        } else if (statusCode === "LAUNCHED" || statusCode === "DRAFT_OPENED" || statusCode === "PICKER_OPENED") {
          finish("Android গ্রহণ করেছে: " + (result.message || statusCode) +
            ". এটি শুধু অ্যাপ/খসড়া/সেটিংস খোলা নিশ্চিত করে—পরবর্তী কাজ বা সেটিং পরিবর্তন নয়।");
        } else {
          finish("Android ফলাফল নিশ্চিত করেনি। অবস্থা: " + String(statusCode || "UNVERIFIED"));
        }
      }).catch(function (error) {
        finish("কাজ সম্পন্ন হয়নি: " + String(error && error.message || "অজানা সমস্যা"));
      });
    });
  }

  window.MosharrofDeviceControl = {parse:parse, request:request, run:run};
})();
