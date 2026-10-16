(function () {
"use strict";
function init() {
  var section = document.getElementById("mosDeviceControls");
  if (!section || section.dataset.communicationUi) return;
  section.dataset.communicationUi = "true";
  var panel = document.createElement("div");
  panel.className = "device-quick-actions";
  panel.innerHTML = '<div class="device-control-group-title">নিরাপদ যোগাযোগ</div><input id="devicePhone" type="tel" maxlength="25" placeholder="ফোন নম্বর"/><button type="button" data-device-action="prepareCall">কলের স্ক্রিন খুলুন</button><textarea id="deviceSmsBody" maxlength="4000" placeholder="SMS বার্তা"></textarea><button type="button" data-device-action="prepareSms">SMS খসড়া খুলুন</button><input id="deviceEmailTo" type="email" maxlength="254" placeholder="ইমেইল ঠিকানা"/><input id="deviceEmailSubject" maxlength="200" placeholder="ইমেইলের বিষয়"/><textarea id="deviceEmailBody" maxlength="10000" placeholder="ইমেইল বার্তা"></textarea><button type="button" data-device-action="prepareEmail">ইমেইল খসড়া খুলুন</button><p>কল/SMS/ইমেইল নিজে পাঠানো হয় না—আপনি ডায়ালার বা সংশ্লিষ্ট অ্যাপে যাচাই করে পাঠাবেন।</p>';
  section.appendChild(panel);
  var plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DeviceCommunication;
  window.MosharrofDeviceCommunicationReady = !!plugin && ["prepareCall","prepareSms","prepareEmail"].every(function (m) { return typeof plugin[m] === "function"; });
  section.addEventListener("click", async function (event) {
    var button = event.target.closest('button[data-device-action^="prepare"]');
    if (!button) return;
    var action = button.getAttribute("data-device-action"), result, number = section.querySelector("#devicePhone").value;
    if (!window.MosharrofDeviceCommunicationReady) { window.alert("যোগাযোগ সুবিধার জন্য আপডেটেড Android APK দরকার।"); return; }
    button.disabled = true;
    try {
      if (action === "prepareCall") result = await plugin.prepareCall({number:number});
      else if (action === "prepareSms") result = await plugin.prepareSms({number:number,body:section.querySelector("#deviceSmsBody").value});
      else if (action === "prepareEmail") result = await plugin.prepareEmail({to:section.querySelector("#deviceEmailTo").value,subject:section.querySelector("#deviceEmailSubject").value,body:section.querySelector("#deviceEmailBody").value});
      if (result && result.opened) window.alert(action === "prepareCall" ? "ডায়ালার খোলা হয়েছে; কল করতে আপনাকে চাপতে হবে।" : "খসড়া খোলা হয়েছে; পাঠানোর আগে অ্যাপে যাচাই করুন।");
    } catch (error) { window.alert("কাজটি খোলা যায়নি: " + String(error && error.message || error)); }
    finally { button.disabled = false; }
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
else init();
})();