package com.mosharrof.ai;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * User-mediated Android settings hub.
 *
 * This bridge opens Android-owned Settings screens only. It does not silently
 * change system settings, bypass permissions, or enable Accessibility services.
 */
@CapacitorPlugin(name = "DeviceControl")
public class DeviceControlPlugin extends Plugin {
    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        result.put("model", Build.MODEL == null ? "" : Build.MODEL);
        result.put("androidVersion", Build.VERSION.RELEASE == null ? "" : Build.VERSION.RELEASE);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put("userMediated", true);
        call.resolve(result);
    }

    @PluginMethod public void openWifiSettings(PluginCall call) { openSettings(call, Settings.ACTION_WIFI_SETTINGS); }
    @PluginMethod public void openBluetoothSettings(PluginCall call) { openSettings(call, Settings.ACTION_BLUETOOTH_SETTINGS); }
    @PluginMethod public void openAppSettings(PluginCall call) { openSettings(call, Settings.ACTION_APPLICATION_SETTINGS); }
    @PluginMethod public void openDisplaySettings(PluginCall call) { openSettings(call, Settings.ACTION_DISPLAY_SETTINGS); }
    @PluginMethod public void openBatterySettings(PluginCall call) { openSettings(call, Settings.ACTION_BATTERY_SAVER_SETTINGS); }
    @PluginMethod public void openLocationSettings(PluginCall call) { openSettings(call, Settings.ACTION_LOCATION_SOURCE_SETTINGS); }
    @PluginMethod public void openSoundSettings(PluginCall call) { openSettings(call, Settings.ACTION_SOUND_SETTINGS); }
    @PluginMethod public void openSecuritySettings(PluginCall call) { openSettings(call, Settings.ACTION_SECURITY_SETTINGS); }
    @PluginMethod public void openPrivacySettings(PluginCall call) { openSettings(call, Settings.ACTION_PRIVACY_SETTINGS); }
    @PluginMethod public void openNotificationSettings(PluginCall call) { openSettings(call, Settings.ACTION_APP_NOTIFICATION_SETTINGS); }
    @PluginMethod public void openStorageSettings(PluginCall call) { openSettings(call, Settings.ACTION_INTERNAL_STORAGE_SETTINGS); }
    @PluginMethod public void openDateTimeSettings(PluginCall call) { openSettings(call, Settings.ACTION_DATE_SETTINGS); }
    @PluginMethod public void openLanguageSettings(PluginCall call) { openSettings(call, Settings.ACTION_LOCALE_SETTINGS); }
    @PluginMethod public void openKeyboardSettings(PluginCall call) { openSettings(call, Settings.ACTION_INPUT_METHOD_SETTINGS); }
    @PluginMethod public void openAccessibilitySettings(PluginCall call) { openSettings(call, Settings.ACTION_ACCESSIBILITY_SETTINGS); }
    @PluginMethod public void openAccountsSettings(PluginCall call) { openSettings(call, Settings.ACTION_SYNC_SETTINGS); }
    @PluginMethod public void openVpnSettings(PluginCall call) { openSettings(call, Settings.ACTION_VPN_SETTINGS); }
    @PluginMethod public void openNfcSettings(PluginCall call) { openSettings(call, Settings.ACTION_NFC_SETTINGS); }
    @PluginMethod public void openDefaultAppsSettings(PluginCall call) { openSettings(call, Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS); }

    @PluginMethod
    public void openAppDetailsSettings(PluginCall call) {
        openSettings(call, Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName()));
    }

    @PluginMethod
    public void openOverlayPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.reject("এই Android সংস্করণে আলাদা Overlay অনুমতি নেই।");
            return;
        }
        openSettings(call, Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName()));
    }

    @PluginMethod
    public void openBatteryOptimizationSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.reject("এই Android সংস্করণে Battery Optimization সেটিংস নেই।");
            return;
        }
        openSettings(call, Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    }


    // Safe communication intents: these open a user-editable draft; they never send or call directly.
    @PluginMethod public void prepareCall(PluginCall call) {
        String number = call.getString("number", "").trim();
        if (!number.matches("[+0-9(). *#-]{3,25}")) { call.reject("ফোন নম্বরটি ঠিক নয়।"); return; }
        openUserIntent(call, new Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null)));
    }
    @PluginMethod public void prepareSms(PluginCall call) {
        String number = call.getString("number", "").trim(), body = call.getString("body", "");
        if (!number.matches("[+0-9(). *#-]{3,25}") || body.trim().isEmpty() || body.length() > 4000) { call.reject("নম্বর বা SMS বার্তাটি ঠিক নয়।"); return; }
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(number)));
        intent.putExtra("sms_body", body);
        openUserIntent(call, intent);
    }
    @PluginMethod public void prepareEmail(PluginCall call) {
        String to = call.getString("to", "").trim(), subject = call.getString("subject", ""), body = call.getString("body", "");
        if (!to.matches("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}") || subject.length() > 200 || body.length() > 10000) { call.reject("ইমেইল ঠিকানা বা খসড়াটি ঠিক নয়।"); return; }
        Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + Uri.encode(to)));
        intent.putExtra(Intent.EXTRA_SUBJECT, subject);
        intent.putExtra(Intent.EXTRA_TEXT, body);
        openUserIntent(call, intent);
    }
    private void openUserIntent(PluginCall call, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject(); result.put("opened", true); result.put("userMediated", true);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("এই কাজের জন্য উপযুক্ত ফোন বা মেসেজ অ্যাপ পাওয়া যায়নি।", error);
        }
    }

    private void openSettings(PluginCall call, String action) {
        openSettings(call, action, null);
    }

    private void openSettings(PluginCall call, String action, Uri data) {
        try {
            Intent intent = new Intent(action);
            if (data != null) intent.setData(data);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("action", action);
            result.put("userMediated", true);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("এই Android সংস্করণ বা নির্মাতার ডিভাইসে সেটিংস পৃষ্ঠা খোলা যায়নি।", error);
        }
    }
}
