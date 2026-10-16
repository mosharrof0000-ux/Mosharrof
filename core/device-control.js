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
["সিস্টেম ও অ্যাপ",[["apps","ইনস্টল করা অ্যাপ"],["defaultApps","ডিফল্ট অ্যাপ"],["dateTime","তারিখ ও সময়"],["language","ভাষা"],["keyboard","কীবোর্ড ও ইনপুট"],["accounts","অ্যাকাউন্ট ও সিঙ্ক"]]],
["ফাইল ও ফোল্ডার",[["fileChooseFolder","অনুমোদিত ফোল্ডার নির্বাচন"],["fileList","ফোল্ডারের ফাইল দেখুন"],["fileCreateFolder","নতুন ফোল্ডার তৈরি"],["fileCreateFile","নতুন টেক্সট ফাইল তৈরি"],["fileRename","ফাইল/ফোল্ডারের নাম পরিবর্তন"],["fileDelete","ফাইল মুছুন"]]]
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
var a=b.getAttribute("data-device-action"),p=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.DeviceControl,fm=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.AndroidFileManager;
if(a==="selfTest"){
  var missing=[];
  if(!p||typeof p.getDeviceInfo!=="function")missing.push("device info");
  Object.keys(methods).forEach(function(k){if(!p||typeof p[methods[k]]!=="function")missing.push(k);});
  ["chooseFolder","listItems","createFolder","createTextFile","renameItem","deleteItem"].forEach(function(k){if(!fm||typeof fm[k]!=="function")missing.push("file:"+k);});
  var d=section.querySelector("#deviceControlDiagnostic");d.hidden=false;
  d.textContent=missing.length?"FAIL — "+missing.join(", "):"PASS — Android settings ও SAF API সংযুক্ত। API সংযোগ মাত্র; বাস্তব ফাইল অপারেশন পরীক্ষা বাকি";
  notify(missing.length?"সংযোগে সমস্যা পাওয়া গেছে।":"API সংযোগ PASS; বাস্তব ডিভাইসে পরীক্ষা বাকি।");return;
}
b.disabled=true;
try{
  if(a.indexOf("file")===0){
    if(!fm){notify("ফাইল ম্যানেজার শুধু আপডেটেড Android APK-তে পাওয়া যাবে।");return;}
    var d=section.querySelector("#deviceControlDiagnostic");d.hidden=false;
    if(a==="fileChooseFolder"){var chosen=await fm.chooseFolder();notify(chosen&&chosen.selected?"ফোল্ডার অনুমোদন সংরক্ষিত।":"ফোল্ডার নির্বাচন সম্পন্ন হয়নি।");d.textContent="অনুমোদিত ফোল্ডার URI: "+String(chosen&&chosen.uri||"");return;}
    if(a==="fileList"){var listing=await fm.listItems();d.textContent="ফোল্ডারের আইটেম ("+listing.count+"):\\n"+JSON.stringify(listing.items,null,2);notify("ফোল্ডারের তালিকা তৈরি হয়েছে।");return;}
    if(a==="fileCreateFolder"){var folderName=window.prompt("নতুন ফোল্ডারের নাম লিখুন");if(!folderName)return;await fm.createFolder({name:folderName});notify("ফোল্ডার তৈরি হয়েছে।");return;}
    if(a==="fileCreateFile"){var fileName=window.prompt("ফাইলের নাম লিখুন, যেমন notes.txt");if(!fileName)return;var fileBody=window.prompt("ফাইলের লেখা লিখুন","");if(fileBody===null)return;await fm.createTextFile({name:fileName,content:fileBody});notify("টেক্সট ফাইল তৈরি হয়েছে।");return;}
    if(a==="fileRename"){var renameId=window.prompt("ফোল্ডারের তালিকা থেকে documentId কপি করুন");if(!renameId)return;var renameName=window.prompt("নতুন নাম লিখুন");if(!renameName)return;await fm.renameItem({documentId:renameId,name:renameName});notify("নাম পরিবর্তন হয়েছে।");return;}
    if(a==="fileDelete"){var deleteId=window.prompt("ফোল্ডারের তালিকা থেকে মুছতে চাওয়া documentId কপি করুন");if(!deleteId)return;if(!window.confirm("সতর্কতা: Android এই ফাইল স্থায়ীভাবে মুছে ফেলতে পারে; ফিরিয়ে আনার নিশ্চয়তা নেই। মুছবেন?"))return;await fm.deleteItem({documentId:deleteId,confirmed:true});notify("মুছে ফেলার অনুরোধ সম্পন্ন হয়েছে।");return;}
  }
  if(!p){notify("ওয়েবসাইট একা ফোনের সেটিংস বদলাতে পারে না। Android APK ব্যবহার করুন।");return;}
  if(a==="info"){var info=await p.getDeviceInfo();notify([info.manufacturer,info.model,"Android "+info.androidVersion].filter(Boolean).join(" · "));return;}
  var m=methods[a];if(!m||typeof p[m]!=="function"){notify("এই সুবিধাটি APK-তে নেই; আপডেটেড APK দরকার।");return;}
  var r=await p[m]();if(r&&r.opened)notify("Android সেটিংস খোলা হয়েছে। পরিবর্তনটি সিস্টেমের স্ক্রিনে করুন。");
}catch(err){notify("কাজটি সম্পন্ন হয়নি: "+String(err&&err.message||err));}
finally{b.disabled=false;}
});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();