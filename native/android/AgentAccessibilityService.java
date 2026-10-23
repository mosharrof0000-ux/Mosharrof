package com.mosharrof.ai;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.content.Context;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Optional, explicitly user-enabled UI inspection and label-based actions. */
public class AgentAccessibilityService extends AccessibilityService {
    private static volatile AgentAccessibilityService instance;
    private static final String[] SENSITIVE = {
        "password", "passcode", "pin", "otp", "verification code", "payment", "pay now",
        "transfer", "send money", "purchase", "buy now", "delete account", "factory reset",
        "পাসওয়ার্ড", "পাসওয়ার্ড", "ওটিপি", "পিন", "টাকা পাঠান", "পেমেন্ট", "কিনুন",
        "অ্যাকাউন্ট মুছুন", "ফ্যাক্টরি রিসেট"
    };

    @Override public void onServiceConnected() {
        instance = this;
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            | AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
            | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;
        info.notificationTimeout = 150;
        setServiceInfo(info);
    }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) { /* inspect on demand only */ }
    @Override public void onInterrupt() { }
    @Override public void onDestroy() {
        if (instance == this) instance = null;
        super.onDestroy();
    }
    public static boolean isConnected() { return instance != null; }
    public static boolean isEnabled(Context context) {
        String enabled = Settings.Secure.getString(context.getContentResolver(),
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return !TextUtils.isEmpty(enabled) && enabled.toLowerCase(Locale.ROOT)
            .contains(context.getPackageName().toLowerCase(Locale.ROOT) + "/"
                + AgentAccessibilityService.class.getName().toLowerCase(Locale.ROOT));
    }
    private static boolean sensitive(String text) {
        String s = text == null ? "" : text.toLowerCase(Locale.ROOT);
        for (String word : SENSITIVE) if (s.contains(word)) return true;
        return false;
    }
    private void collect(AccessibilityNodeInfo node, JSONArray out, int depth) {
        if (node == null || depth > 20 || out.length() >= 120) return;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        boolean password = node.isPassword();
        String label = password ? "" : (text != null && text.length() > 0 ? text.toString()
            : (desc != null ? desc.toString() : ""));
        if (!label.isEmpty() && !sensitive(label)) {
            JSONObject item = new JSONObject();
            try {
                item.put("label", label.substring(0, Math.min(label.length(), 180)));
                item.put("clickable", node.isClickable());
                item.put("enabled", node.isEnabled());
                item.put("editable", node.isEditable());
                out.put(item);
            } catch (Exception ignored) { }
        }
        for (int i = 0; i < node.getChildCount(); i++) collect(node.getChild(i), out, depth + 1);
    }
    public static JSONArray inspect() {
        AgentAccessibilityService s = instance;
        JSONArray out = new JSONArray();
        if (s != null) s.collect(s.getRootInActiveWindow(), out, 0);
        return out;
    }
    private void collectExactMatches(AccessibilityNodeInfo node, String target,
            List<AccessibilityNodeInfo> matches, int depth) {
        if (node == null || depth > 20 || matches.size() > 1) return;
        String label = "";
        if (!node.isPassword()) {
            CharSequence text = node.getText(), description = node.getContentDescription();
            label = text != null ? text.toString() : (description != null ? description.toString() : "");
        }
        String normalized = label.toLowerCase(Locale.ROOT).trim();
        if (!target.isEmpty() && normalized.equals(target) && !sensitive(normalized)
                && !node.isPassword() && !node.isEditable() && node.isEnabled() && node.isClickable()) {
            matches.add(node);
            return;
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            collectExactMatches(node.getChild(i), target, matches, depth + 1);
            if (matches.size() > 1) return;
        }
    }
    public static boolean tapLabel(String label) {
        AgentAccessibilityService service = instance;
        if (service == null || label == null || label.trim().isEmpty() || sensitive(label)) return false;
        AccessibilityNodeInfo root = service.getRootInActiveWindow();
        if (root == null || service.containsSensitiveNode(root, 0)) return false;
        List<AccessibilityNodeInfo> matches = new ArrayList<>();
        service.collectExactMatches(root, label.toLowerCase(Locale.ROOT).trim(), matches, 0);
        return matches.size() == 1 && matches.get(0).performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }
    public static boolean scroll(boolean forward) {
        AgentAccessibilityService s = instance;
        AccessibilityNodeInfo root = s == null ? null : s.getRootInActiveWindow();
        return root != null && root.performAction(forward
            ? AccessibilityNodeInfo.ACTION_SCROLL_FORWARD : AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);
    }

    /** Narrow allowlist of non-destructive Android-wide navigation actions. */
    public static boolean performSafeGlobalAction(String action) {
        AgentAccessibilityService s = instance;
        if (s == null || action == null) return false;
        switch (action) {
            case "back": return s.performGlobalAction(GLOBAL_ACTION_BACK);
            case "home": return s.performGlobalAction(GLOBAL_ACTION_HOME);
            case "notifications": return s.performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
            case "quick_settings": return s.performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
            case "recents": return s.performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "power_dialog": return s.performGlobalAction(GLOBAL_ACTION_POWER_DIALOG);
            case "screenshot": return s.performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT);
            default: return false;
        }
    }

    public interface GestureResult { void onResult(boolean success); }

    private boolean containsSensitiveNode(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 20) return false;
        if (node.isPassword()) return true;
        CharSequence text = node.getText();
        CharSequence description = node.getContentDescription();
        if (sensitive(text == null ? "" : text.toString())
                || sensitive(description == null ? "" : description.toString())) return true;
        for (int i = 0; i < node.getChildCount(); i++) {
            if (containsSensitiveNode(node.getChild(i), depth + 1)) return true;
        }
        return false;
    }

    public static void requestSwipe(int startX, int startY, int endX, int endY,
            long durationMs, GestureResult result) {
        AgentAccessibilityService service = instance;
        if (service == null) {
            result.onResult(false);
            return;
        }
        service.swipeCoordinates(startX, startY, endX, endY, durationMs, result);
    }

    public void swipeCoordinates(int startX, int startY, int endX, int endY,
            long durationMs, GestureResult result) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null || containsSensitiveNode(root, 0)) {
            result.onResult(false);
            return;
        }
        Rect bounds = new Rect();
        root.getBoundsInScreen(bounds);
        int width = getResources().getDisplayMetrics().widthPixels;
        int height = getResources().getDisplayMetrics().heightPixels;
        if (startX < 0 || startY < 0 || endX < 0 || endY < 0
                || startX >= width || endX >= width || startY >= height || endY >= height
                || !bounds.contains(startX, startY) || !bounds.contains(endX, endY)) {
            result.onResult(false);
            return;
        }
        long duration = Math.max(100L, Math.min(durationMs, 1500L));
        Path path = new Path();
        path.moveTo(startX, startY);
        path.lineTo(endX, endY);
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(new GestureDescription.StrokeDescription(path, 0, duration))
            .build();
        boolean queued = dispatchGesture(gesture, new GestureResultCallback() {
            @Override public void onCompleted(GestureDescription description) {
                result.onResult(true);
            }
            @Override public void onCancelled(GestureDescription description) {
                result.onResult(false);
            }
        }, null);
        if (!queued) result.onResult(false);
    }
}