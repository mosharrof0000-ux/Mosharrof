package com.mosharrof.ai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.UUID;

/**
 * User-mediated package install/uninstall bridge for the MOSHARROF Android wrapper.
 * Android's own installer/uninstaller remains authoritative; SUCCEEDED requires observed package state.
 */
@CapacitorPlugin(name = "AppPackage")
public class AppPackagePlugin extends Plugin {

    @PluginMethod
    public void installAppFromPicker(PluginCall call) {
        String requestId = requestId(call);
        new AlertDialog.Builder(getActivity())
            .setTitle("APK নির্বাচন")
            .setMessage("শুধু বিশ্বস্ত উৎসের APK নির্বাচন করুন। Android-এর নিজস্ব ইনস্টল অনুমতি ও নিশ্চিতকরণ লাগবে।")
            .setNegativeButton("বাতিল", (dialog, which) -> resolve(call, requestId, "INSTALL_APK", "CANCELLED",
                "ব্যবহারকারী APK নির্বাচন বাতিল করেছেন।", null, false))
            .setPositiveButton("APK বাছুন", (dialog, which) -> {
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("application/vnd.android.package-archive");
                startActivityForResult(call, picker, "apkPickerResult");
            })
            .show();
    }

    @ActivityCallback
    private void apkPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String requestId = requestId(call);
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
                || result.getData().getData() == null) {
            resolve(call, requestId, "INSTALL_APK", "CANCELLED", "APK নির্বাচন বাতিল হয়েছে; ইনস্টল শুরু হয়নি।", null, false);
            return;
        }
        Uri apkUri = result.getData().getData();
        AppPackagePlatform.ApkMetadata metadata = AppPackagePlatform.inspectApk(getContext(), apkUri);
        if (metadata == null) {
            resolve(call, requestId, "INSTALL_APK", "FAILED", "APK ফাইল পড়া যায়নি বা বৈধ package/version metadata পাওয়া যায়নি।", null, false);
            return;
        }
        if (metadata.packageName.equals(getContext().getPackageName())) {
            resolve(call, requestId, "INSTALL_APK", "FAILED", "MOSHARROF নিজস্ব প্যাকেজকে এই সাধারণ ইনস্টল-পথ দিয়ে প্রতিস্থাপন করবে না।", metadata.packageName, false);
            return;
        }
        Long previousVersion = AppPackagePlatform.installedVersion(getContext(), metadata.packageName);
        new AlertDialog.Builder(getActivity())
            .setTitle("ইনস্টল নিশ্চিত করুন")
            .setMessage("Package: " + metadata.packageName + "\nVersion: " + metadata.versionCode
                + "\nAndroid-এর installer খুলবে। চূড়ান্ত অনুমতি আপনাকেই দিতে হবে।")
            .setNegativeButton("বাতিল", (dialog, which) ->
                resolve(call, requestId, "INSTALL_APK", "CANCELLED", "ব্যবহারকারী ইনস্টল বাতিল করেছেন।", metadata.packageName, false))
            .setPositiveButton("Android installer খুলুন", (dialog, which) -> {
                AppPackagePendingStore.save(getContext(), requestId, "INSTALL_APK", metadata.packageName, metadata.versionCode, previousVersion);
                Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                install.setDataAndType(apkUri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(call, install, "installResult");
                } catch (Exception error) {
                    AppPackagePendingStore.clear(getContext());
                    resolve(call, requestId, "INSTALL_APK", "FAILED", "Android installer খোলা যায়নি।", metadata.packageName, false);
                }
            })
            .show();
    }

    @ActivityCallback
    private void installResult(PluginCall call, ActivityResult result) {
        if (call == null) { clearPending(); return; }
        AppPackagePendingStore.Pending pending = AppPackagePendingStore.read(getContext());
        clearPending();
        if (pending == null || !"INSTALL_APK".equals(pending.action)) {
            resolve(call, requestId(call), "INSTALL_APK", "UNKNOWN", "ইনস্টল ফলের pending request পাওয়া যায়নি।", null, false);
            return;
        }
        Long currentVersion = AppPackagePlatform.installedVersion(getContext(), pending.packageName);
        boolean versionMatches = currentVersion != null && currentVersion >= 0L && currentVersion == pending.expectedVersion;
        boolean stateChanged = pending.previousVersion == null || !pending.previousVersion.equals(currentVersion);
        if (versionMatches && (result.getResultCode() == Activity.RESULT_OK || stateChanged)) {
            resolve(call, pending.requestId, "INSTALL_APK", "SUCCEEDED",
                "ইনস্টল যাচাই সফল: ইনস্টল করা package/version নির্বাচিত APK-এর সঙ্গে মিলেছে।",
                pending.packageName, true);
        } else if (result.getResultCode() == Activity.RESULT_CANCELED) {
            resolve(call, pending.requestId, "INSTALL_APK", "CANCELLED",
                "Android ইনস্টল নিশ্চিত করেনি; প্যাকেজ-অবস্থা সফলতা প্রমাণ করেনি।", pending.packageName, false);
        } else if (currentVersion == null) {
            resolve(call, pending.requestId, "INSTALL_APK", "FAILED",
                "ফিরে আসার পর লক্ষ্য প্যাকেজ ইনস্টল পাওয়া যায়নি।", pending.packageName, false);
        } else {
            resolve(call, pending.requestId, "INSTALL_APK", "UNKNOWN",
                "ইনস্টল ফল নিশ্চিত নয়: লক্ষ্য প্যাকেজের সংস্করণ নির্বাচিত APK-এর সঙ্গে মেলেনি।", pending.packageName, false);
        }
    }

    @PluginMethod
    public void uninstallApp(PluginCall call) {
        String requestId = requestId(call);
        String target = call.getString("target", "").trim();
        String packageName = AppPackagePlatform.resolveInstalledPackage(getContext(), target);
        if (packageName == null) {
            resolve(call, requestId, "UNINSTALL_APP", "FAILED",
                "একটি মাত্র ইনস্টল করা অ্যাপের সঙ্গে target মেলেনি; কিছু সরানো হয়নি।", null, false);
            return;
        }
        if (packageName.equals(getContext().getPackageName())) {
            resolve(call, requestId, "UNINSTALL_APP", "FAILED", "MOSHARROF নিজেকে এই কমান্ড দিয়ে আনইনস্টল করতে পারবে না।", packageName, false);
            return;
        }
        Long previousVersion = installedVersion(packageName);
        new AlertDialog.Builder(getActivity())
            .setTitle("আনইনস্টল নিশ্চিত করুন")
            .setMessage("Package: " + packageName + "\nAndroid-এর নিজস্ব আনইনস্টল স্ক্রিন খুলবে। চূড়ান্ত সিদ্ধান্ত আপনাকেই দিতে হবে।")
            .setNegativeButton("বাতিল", (dialog, which) ->
                resolve(call, requestId, "UNINSTALL_APP", "CANCELLED", "ব্যবহারকারী আনইনস্টল বাতিল করেছেন।", packageName, false))
            .setPositiveButton("Android uninstall screen খুলুন", (dialog, which) -> {
                AppPackagePendingStore.save(getContext(), requestId, "UNINSTALL_APP", packageName, -1L, previousVersion);
                try {
                    startActivityForResult(call, new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + packageName)), "uninstallResult");
                } catch (Exception error) {
                    clearPending();
                    resolve(call, requestId, "UNINSTALL_APP", "FAILED", "Android আনইনস্টল স্ক্রিন খোলা যায়নি।", packageName, false);
                }
            })
            .show();
    }

    @ActivityCallback
    private void uninstallResult(PluginCall call, ActivityResult result) {
        if (call == null) { clearPending(); return; }
        Pending pending = readPending();
        clearPending();
        if (pending == null || !"UNINSTALL_APP".equals(pending.action)) {
            resolve(call, requestId(call), "UNINSTALL_APP", "UNKNOWN", "আনইনস্টল ফলের pending request পাওয়া যায়নি।", null, false);
            return;
        }
        Long currentVersion = installedVersion(pending.packageName);
        if (currentVersion == null) {
            resolve(call, pending.requestId, "UNINSTALL_APP", "SUCCEEDED",
                "আনইনস্টল যাচাই সফল: লক্ষ্য প্যাকেজ আর ইনস্টল করা নেই।", pending.packageName, true);
        } else if (currentVersion < 0L) {
            resolve(call, pending.requestId, "UNINSTALL_APP", "UNKNOWN",
                "ফিরে আসার পর package state পড়া যায়নি; সফলতা দাবি করা হয়নি।", pending.packageName, false);
        } else if (result.getResultCode() == Activity.RESULT_CANCELED) {
            resolve(call, pending.requestId, "UNINSTALL_APP", "CANCELLED",
                "ব্যবহারকারী বা Android আনইনস্টল নিশ্চিত করেনি; অ্যাপটি এখনও ইনস্টল আছে।", pending.packageName, false);
        } else {
            resolve(call, pending.requestId, "UNINSTALL_APP", "UNKNOWN",
                "আনইনস্টল ফল নিশ্চিত নয়; লক্ষ্য প্যাকেজ এখনও ইনস্টল আছে।", pending.packageName, false);
        }
    }

    @PluginMethod
    public void searchPlayStore(PluginCall call) {
        String requestId = requestId(call);
        String query = call.getString("query", "").trim();
        if (query.isEmpty() || query.length() > 120) {
            resolve(call, requestId, "SEARCH_PLAY_STORE", "FAILED", "অ্যাপের নাম ১২০ অক্ষরের মধ্যে দিন।", null, false);
            return;
        }
        new AlertDialog.Builder(getActivity())
            .setTitle("Play Store-এ অ্যাপ খুঁজুন")
            .setMessage("\"" + query + "\" সার্চ খোলা হবে। সার্চ খোলা ইনস্টল সফল হওয়ার প্রমাণ নয়।")
            .setNegativeButton("বাতিল", (dialog, which) ->
                resolve(call, requestId, "SEARCH_PLAY_STORE", "CANCELLED", "ব্যবহারকারী Play Store সার্চ বাতিল করেছেন।", null, false))
            .setPositiveButton("Play Store খুলুন", (dialog, which) -> {
                try {
                    Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://search?q=" + Uri.encode(query)));
                    getActivity().startActivity(market);
                    resolve(call, requestId, "SEARCH_PLAY_STORE", "AWAITING_USER_CONFIRMATION",
                        "Play Store সার্চ খোলা হয়েছে; ইনস্টল হয়েছে কি না যাচাই করা হয়নি।", null, false);
                } catch (Exception error) {
                    try {
                        Intent web = new Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://play.google.com/store/search?q=" + Uri.encode(query) + "&c=apps"));
                        getActivity().startActivity(web);
                        resolve(call, requestId, "SEARCH_PLAY_STORE", "AWAITING_USER_CONFIRMATION",
                            "ওয়েব Play Store সার্চ খোলা হয়েছে; ইনস্টল সফল হওয়ার প্রমাণ নয়।", null, false);
                    } catch (Exception second) {
                        resolve(call, requestId, "SEARCH_PLAY_STORE", "FAILED", "Play Store সার্চ খোলা যায়নি।", null, false);
                    }
                }
            })
            .show();
    }

    private String requestId(PluginCall call) {
        String value = call.getString("requestId", "");
        return value == null || value.trim().isEmpty() || value.length() > 128
            ? UUID.randomUUID().toString() : value.trim();
    }

    private void resolve(PluginCall call, String requestId, String action, String status,
                         String detail, String packageName, boolean packageStateVerified) {
        if (call == null) return;
        JSObject out = new JSObject();
        out.put("requestId", requestId);
        out.put("action", action);
        out.put("status", status);
        out.put("detail", detail);
        out.put("packageName", packageName);
        out.put("packageStateVerified", packageStateVerified);
        if ("SUCCEEDED".equals(status) && !packageStateVerified) {
            out.put("status", "UNKNOWN");
            out.put("detail", "প্যাকেজ state যাচাই ছাড়া সফলতা দাবি করা হয়নি।");
        }
        call.resolve(out);
    }
}
