/* MOSHARROF Android settings hub. Actions open Android-owned Settings only.
 * Contract markers: section.id = "mosDeviceControls"; data-device-action="wifi"; ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না.
 */
(function () {
"use strict";
function notify(s){var t=document.getElementById("toast");if(!t){window.alert(s);return;}t.textContent=s;t.classList.add("show");window.setTimeout(function(){t.classList.remove("show");},3600);}
var groups=[
["সংযোগ",[["wifi","Wi‑Fi"],["bluetooth","Bluetooth"],["vpn","VPN"],["nfc","NFC"]]],
["ডিভাইস",[["info","ডিভাইসের তথ্য"],["display","ডিসপ্লে"],["sound","শব্দ ও রিংটোন"],["battery","ব্যাটারি"],["storage","স্টোরেজ"],["batteryOptimization","ব্যাটারি অপ্টিমাইজেশন"]]],
["গোপনীয়তা ও নিরাপত্তা",[["location","লোকেশন"],["privacy","গোপনীয়তা"],["security","নিরাপত্তা"],["notifications","নোটিফিকেশন"],["accessibility","Accessibility"],["overlay","অন্য অ্যাপের ওপর দেখানো"],["appDetails","MOSHARROF অ্যাপের অনুমতি"]]],
["সিস্টেম ও অ্যাপ",[["apps","ইনস্টল করা অ্যাপ"],["defaultApps","ডিফল্ট অ্যাপ"],["dateTime","তারিখ ও সময়"],["language","ভাষা"],["keyboard","কীবোর্ড ও ইনপুট"],["accounts","অ্যাকাউন্ট ও সিঙ্ক"]]]
];
var methods={wifi:"openWifiSettings",bluetooth:"openBluetoothSettings",vpn:"openVpnSettings",nfc:"openNfcSettings",display:"openDisplaySettings",sound:"openSoundSettings",battery:"openBatterySettings",storage:"openStorageSettings",batteryOptimization:"openBatteryOptimizationSettings",location:"openLocationSettings",privacy:"openPrivacySettings",security:"openSecuritySettings",notifications:"openNotificationSettings",accessibility:"openAccessibilitySettings",overlay:"openOverlayPermissionSettings",appDetails:"openAppDetailsSettings",apps:"openAppSettings",defaultApps:"openDefaultAppsSettings",dateTime:"openDateTimeSettings",language:"openLanguageSettings",keyboard:"openKeyboardSettings",accounts:"openAccountsSettings"};
function init(){
var nav=document.getElementById("navR");if(!nav||document.getElementById("mosDeviceControls"))return;
var section=document.createElement("section");section.className="nav-family";section.id="mosDeviceControls";
var html='<div class="nav-family-title"><span aria-hidden="true">▣</span><span>Android ডিভাইস নিয়ন্ত্রণ</span></div><p>নিরাপদ নিয়ন্ত্রণ: Android সেটিংস খুলবে; পরিবর্তন আপনাকে সেখানে নিশ্চিত করতে হবে।</p><button type="button" data-device-action="selfTest">সব নিয়ন্ত্রণের সংযোগ পরীক্ষা</button><p id="deviceControlDiagnostic" role="status" aria-live="polite" hidden></p>';
groups.forEach(function(g){html+='<div class="device-control-group"><div class="device-control-group-title">'+g[0]+'</div><div class="nav-family-items">';g[1].forEach(function(a){html+='<button type="button" data-device-action="'+a[0]+'"><span class="nav-icon" aria-hidden="true">⚙</span><span class="nav-copy"><span>'+a[1]+'</span></span></button>';});html+='</div></div>';});
section.innerHTML=html;nav.appendChild(section);
section.addEventListener("click",async function(e){
var b=e.target.closest("button[data-device-action]");if(!b)return;
var a=b.getAttribute("data-device-action"),p=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.DeviceControl;
if(a==="selfTest"){var missing=[];if(!p||typeof p.getDeviceInfo!=="function")missing.push("device info");Object.keys(methods).forEach(function(k){if(!p||typeof p[methods[k]]!=="function")missing.push(k);});var d=section.querySelector("#deviceControlDiagnostic");d.hidden=false;d.textContent=missing.length?"FAIL — "+missing.join(", "):"PASS — ২২টি অ্যাকশন সংযুক্ত। API সংযোগ মাত্র; ফোনে যাচাই নয়। ফাইল অপারেশন বাস্তব ডিভাইসে এখনও পরীক্ষা হয়নি।";notify(missing.length?"সংযোগে সমস্যা পাওয়া গেছে।":"API সংযোগ PASS; বাস্তব স্ক্রিন পরীক্ষা বাকি।");return;}
if(!p){notify("ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না। Android APK ব্যবহার করুন।");return;}
b.disabled=true;
try{if(a==="info"){var d=await p.getDeviceInfo();notify([d.manufacturer,d.model,"Android "+d.androidVersion].filter(Boolean).join(" · "));return;}
var m=methods[a];if(!m||typeof p[m]!=="function"){notify("এই সুবিধাটি APK-তে নেই; আপডেটেড APK দরকার।");return;}
var r=await p[m]();if(r&&r.opened)notify("Android সেটিংস খোলা হয়েছে। পরিবর্তনটি সিস্টেমের স্ক্রিনে করুন।");
}catch(err){notify("সেটিংস খোলা যায়নি: "+String(err&&err.message||err));}finally{b.disabled=false;}
});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();