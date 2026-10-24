package com.mosharrof.ai;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * User-mediated package install/uninstall bridge for the MOSHARROF Android wrapper.
 * Android's own installer/uninstaller remains authoritative; SUCCEEDED requires observed package state.
 */
@CapacitorPlugin(name = "AppPackage")
public class AppPackagePlugin extends Plugin {
    private static final String PREFS = "mosharrof_app_package_pending";
    private static final long MAX_APK_BYTES = 512L * 1024L * 1024L;
    private static final Pattern PACKAGE_NAME = Pattern.compile("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+");

    private static final class ApkMetadata {
        final String packageName;
        final long versionCode;
        ApkMetadata(String packageName, long versionCode) {
            this.packageName = packageName;
            this.versionCode = versionCode;
        }
    }

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
        ApkMetadata metadata = inspectApk(apkUri);
        if (metadata == null) {
            resolve(call, requestId, "INSTALL_APK", "FAILED", "APK ফাইল পড়া যায়নি বা বৈধ package/version metadata পাওয়া যায়নি।", null, false);
            return;
        }
        if (metadata.packageName.equals(getContext().getPackageName())) {
            resolve(call, requestId, "INSTALL_APK", "FAILED", "MOSHARROF নিজস্ব প্যাকেজকে এই সাধারণ ইনস্টল-পথ দিয়ে প্রতিস্থাপন করবে না।", metadata.packageName, false);
            return;
        }
        Long previousVersion = installedVersion(metadata.packageName);
        new AlertDialog.Builder(getActivity())
            .setTitle("ইনস্টল নিশ্চিত করুন")
            .setMessage("Package: " + metadata.packageName + "\nVersion: " + metadata.versionCode
                + "\nAndroid-এর installer খুলবে। চূড়ান্ত অনুমতি আপনাকেই দিতে হবে।")
            .setNegativeButton("বাতিল", (dialog, which) ->
                resolve(call, requestId, "INSTALL_APK", "CANCELLED", "ব্যবহারকারী ইনস্টল বাতিল করেছেন।", metadata.packageName, false))
            .setPositiveButton("Android installer খুলুন", (dialog, which) -> {
                savePending(requestId, "INSTALL_APK", metadata.packageName, metadata.versionCode, previousVersion);
                Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
                install.setDataAndType(apkUri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(call, install, "installResult");
                } catch (Exception error) {
                    clearPending();
                    resolve(call, requestId, "INSTALL_APK", "FAILED", "Android installer খোলা যায়নি।", metadata.packageName, false);
                }
            })
            .show();
    }

    @ActivityCallback
    private void installResult(PluginCall call, ActivityResult result) {
        if (call == null) { clearPending(); return; }
        Pending pending = readPending();
        clearPending();
        if (pending == null || !"INSTALL_APK".equals(pending.action)) {
            resolve(call, requestId(call), "INSTALL_APK", "UNKNOWN", "ইনস্টল ফলের pending request পাওয়া যায়নি।", null, false);
            return;
        }
        Long currentVersion = installedVersion(pending.packageName);
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
        String packageName = resolveInstalledPackage(target);
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
                savePending(requestId, "UNINSTALL_APP", packageName, -1L, previousVersion);
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

    private ApkMetadata inspectApk(Uri uri) {
        if (uri == null || !"content".equals(uri.getScheme())) return null;
        File temp = null;
        try {
            temp = File.createTempFile("mosharrof-apk-", ".apk", getContext().getCacheDir());
            try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                 FileOutputStream output = new FileOutputStream(temp)) {
                if (input == null) return null;
                byte[] buffer = new byte[16 * 1024];
                long total = 0L;
                int count;
                while ((count = input.read(buffer)) >= 0) {
                    total += count;
                    if (total > MAX_APK_BYTES) return null;
                    output.write(buffer, 0, count);
                }
            }
            @SuppressWarnings("deprecation")
            PackageInfo info = getContext().getPackageManager().getPackageArchiveInfo(temp.getAbsolutePath(), 0);
            if (info == null || info.packageName == null || !PACKAGE_NAME.matcher(info.packageName).matches()) return null;
            long version = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            return new ApkMetadata(info.packageName, version);
        } catch (Exception ignored) {
            return null;
        } finally {
            if (temp != null) temp.delete();
        }
    }

    private String resolveInstalledPackage(String target) {
        if (target == null || target.trim().isEmpty() || target.length() > 200) return null;
        String normalized = target.trim();
        if (PACKAGE_NAME.matcher(normalized).matches()) return installedVersion(normalized) != null && installedVersion(normalized) >= 0L ? normalized : null;
        try {
            Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<android.content.pm.ResolveInfo> matches = getContext().getPackageManager().queryIntentActivities(launcher, 0);
            List<String> packages = new ArrayList<>();
            for (android.content.pm.ResolveInfo item : matches) {
                CharSequence label = item.loadLabel(getContext().getPackageManager());
                if (label != null && normalized.equalsIgnoreCase(label.toString().trim())
                        && item.activityInfo != null && item.activityInfo.packageName != null
                        && !packages.contains(item.activityInfo.packageName)) {
                    packages.add(item.activityInfo.packageName);
                }
            }
            return packages.size() == 1 ? packages.get(0) : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Long installedVersion(String packageName) {
        try {
            @SuppressWarnings("deprecation")
            PackageInfo info = getContext().getPackageManager().getPackageInfo(packageName, 0);
            return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : (long) info.versionCode;
        } catch (PackageManager.NameNotFoundException notInstalled) {
            return null;
        } catch (Exception unknown) {
            return -1L;
        }
    }

    private static final class Pending {
        String requestId;
        String action;
        String packageName;
        long expectedVersion;
        Long previousVersion;
    }

    private void savePending(String requestId, String action, String packageName, long expectedVersion, Long previousVersion) {
        getContext().getSharedPreferences(PREFS, 0).edit()
            .putString("request_id", requestId)
            .putString("action", action)
            .putString("package_name", packageName)
            .putLong("expected_version", expectedVersion)
            .putBoolean("has_previous", previousVersion != null)
            .putLong("previous_version", previousVersion == null ? -1L : previousVersion)
            .apply();
    }

    private Pending readPending() {
        android.content.SharedPreferences prefs = getContext().getSharedPreferences(PREFS, 0);
        String requestId = prefs.getString("request_id", null);
        String action = prefs.getString("action", null);
        String packageName = prefs.getString("package_name", null);
        if (requestId == null || action == null || packageName == null) return null;
        Pending pending = new Pending();
        pending.requestId = requestId;
        pending.action = action;
        pending.packageName = packageName;
        pending.expectedVersion = prefs.getLong("expected_version", -1L);
        pending.previousVersion = prefs.getBoolean("has_previous", false)
            ? prefs.getLong("previous_version", -1L) : null;
        return pending;
    }

    private void clearPending() {
        getContext().getSharedPreferences(PREFS, 0).edit().clear().apply();
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
