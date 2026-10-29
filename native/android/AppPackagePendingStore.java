package com.mosharrof.ai;

import android.content.Context;

/** Durable metadata for correlating an Android system confirmation result. */
public final class AppPackagePendingStore {
    private static final String PREFS = "mosharrof_app_package_pending";

    public static final class Pending {
        public String requestId;
        public String action;
        public String packageName;
        public long expectedVersion;
        public Long previousVersion;
    }

    private AppPackagePendingStore() {}

    public static void save(Context context, String requestId, String action, String packageName,
                            long expectedVersion, Long previousVersion) {
        context.getSharedPreferences(PREFS, 0).edit()
            .putString("request_id", requestId)
            .putString("action", action)
            .putString("package_name", packageName)
            .putLong("expected_version", expectedVersion)
            .putBoolean("has_previous", previousVersion != null)
            .putLong("previous_version", previousVersion == null ? -1L : previousVersion)
            .apply();
    }

    public static Pending read(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences(PREFS, 0);
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

    public static void clear(Context context) {
        context.getSharedPreferences(PREFS, 0).edit().clear().apply();
    }
}
