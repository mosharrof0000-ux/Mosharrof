package com.mosharrof.ai;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** User-enabled, on-device Accessibility actions. */
@CapacitorPlugin(name = "AndroidAccessibility")
public class AndroidAccessibilityPlugin extends Plugin {
    @PluginMethod
    public void getAccessibilityStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabledInSettings", AgentAccessibilityService.isEnabled(getContext()));
        result.put("connected", AgentAccessibilityService.isConnected());
        result.put("userMustEnableInSettings", true);
        call.resolve(result);
    }

    @PluginMethod
    public void inspectVisibleUi(PluginCall call) {
        if (!AgentAccessibilityService.isConnected()) {
            call.reject("প্রথমে Android Settings থেকে MOSHARROF AI Accessibility চালু করুন।");
            return;
        }
        JSObject result = new JSObject();
        result.put("items", AgentAccessibilityService.inspect());
        result.put("inspectedOnDevice", true);
        call.resolve(result);
    }

    @PluginMethod
    public void tapVisibleLabel(PluginCall call) {
        String label = call.getString("label", "");
        if (label == null || label.trim().isEmpty() || label.length() > 120) {
            call.reject("দৃশ্যমান নিয়ন্ত্রণের সংক্ষিপ্ত নাম দিন।");
            return;
        }
        if (!AgentAccessibilityService.isConnected()) {
            call.reject("প্রথমে Android Settings থেকে MOSHARROF AI Accessibility চালু করুন।");
            return;
        }
        boolean clicked = AgentAccessibilityService.tapLabel(label);
        JSObject result = new JSObject();
        result.put("clicked", clicked);
        result.put("targetLabel", label);
        result.put("verified", false);
        if (clicked) call.resolve(result);
        else call.reject("নিরাপদ, ক্লিকযোগ্য লেবেল পাওয়া যায়নি; কোনো ট্যাপ করা হয়নি।");
    }

    @PluginMethod
    public void scrollVisibleUi(PluginCall call) {
        if (!AgentAccessibilityService.isConnected()) {
            call.reject("প্রথমে Android Settings থেকে MOSHARROF AI Accessibility চালু করুন।");
            return;
        }
        boolean forward = call.getBoolean("forward", true);
        boolean moved = AgentAccessibilityService.scroll(forward);
        JSObject result = new JSObject();
        result.put("scrolled", moved);
        result.put("verified", false);
        if (moved) call.resolve(result);
        else call.reject("বর্তমান স্ক্রিনে স্ক্রল করা যায়নি।");
    }

@PluginMethod
    public void swipeVisibleUi(PluginCall call) {
        if (!AgentAccessibilityService.isConnected()) {
            call.reject("প্রথমে Android Settings থেকে MOSHARROF AI Accessibility চালু করুন।");
            return;
        }
        int startX = call.getInt("startX", -1);
        int startY = call.getInt("startY", -1);
        int endX = call.getInt("endX", -1);
        int endY = call.getInt("endY", -1);
        int durationMs = call.getInt("durationMs", 500);
        if (startX < 0 || startY < 0 || endX < 0 || endY < 0
                || durationMs < 100 || durationMs > 1500) {
            call.reject("স্ক্রিনের বৈধ X/Y স্থানাঙ্ক এবং ১০০–১৫০০ ms সময় দিন।");
            return;
        }
        AgentAccessibilityService.requestSwipe(startX, startY, endX, endY, durationMs, success -> {
            if (!success) {
                call.reject("সোয়াইপ নিরাপদভাবে সম্পন্ন হয়নি; স্থানাঙ্ক, স্ক্রিন বা সংবেদনশীল তথ্য যাচাই করুন।");
                return;
            }
            JSObject result = new JSObject();
            result.put("dispatched", true);
            result.put("verified", false);
            result.put("note", "সোয়াইপ পাঠানো হয়েছে; পরের ধাপে স্ক্রিনের ফলাফল যাচাই করুন।");
            call.resolve(result);
        });
    }
}
