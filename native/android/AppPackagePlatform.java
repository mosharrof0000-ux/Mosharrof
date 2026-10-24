package com.mosharrof.ai;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Narrow package metadata and visibility adapter. Never executes an APK. */
public final class AppPackagePlatform {
    private static final long MAX_APK_BYTES = 512L * 1024L * 1024L;
    private static final Pattern PACKAGE_NAME = Pattern.compile("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+");

    public static final class ApkMetadata {
        public final String packageName;
        public final long versionCode;
        ApkMetadata(String packageName, long versionCode) {
            this.packageName = packageName;
            this.versionCode = versionCode;
        }
    }

    private AppPackagePlatform() {}

    public static ApkMetadata inspectApk(Context context, Uri uri) {
        if (uri == null || !"content".equals(uri.getScheme())) return null;
        File temp = null;
        try {
            temp = File.createTempFile("mosharrof-apk-", ".apk", context.getCacheDir());
            try (InputStream input = context.getContentResolver().openInputStream(uri);
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
            PackageInfo info = context.getPackageManager().getPackageArchiveInfo(temp.getAbsolutePath(), 0);
            if (info == null || info.packageName == null || !PACKAGE_NAME.matcher(info.packageName).matches()) return null;
            long version = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            return new ApkMetadata(info.packageName, version);
        } catch (Exception ignored) {
            return null;
        } finally {
            if (temp != null) temp.delete();
        }
    }

    public static String resolveInstalledPackage(Context context, String target) {
        if (target == null || target.trim().isEmpty() || target.length() > 200) return null;
        String normalized = target.trim();
        if (PACKAGE_NAME.matcher(normalized).matches()) {
            Long version = installedVersion(context, normalized);
            return version != null && version >= 0L ? normalized : null;
        }
        try {
            Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<android.content.pm.ResolveInfo> matches = context.getPackageManager().queryIntentActivities(launcher, 0);
            List<String> packages = new ArrayList<>();
            for (android.content.pm.ResolveInfo item : matches) {
                CharSequence label = item.loadLabel(context.getPackageManager());
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

    /** null means not installed; -1 means package state could not be read reliably. */
    public static Long installedVersion(Context context, String packageName) {
        try {
            @SuppressWarnings("deprecation")
            PackageInfo info = context.getPackageManager().getPackageInfo(packageName, 0);
            return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : (long) info.versionCode;
        } catch (android.content.pm.PackageManager.NameNotFoundException notInstalled) {
            return null;
        } catch (Exception unknown) {
            return -1L;
        }
    }
}
