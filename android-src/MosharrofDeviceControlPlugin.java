package com.mosharrof.ai;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.os.StatFs;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "MosharrofDeviceControl")
public class MosharrofDeviceControlPlugin extends Plugin {
    private static final Pattern PHONE = Pattern.compile("^\\+?[0-9]{6,16}$");
    private static final Pattern PACKAGE = Pattern.compile("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+){1,}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @PluginMethod
    public void openSettings(PluginCall call) {
        String page = call.getString("page", "general");
        String action;
        switch (page == null ? "general" : page) {
            case "wifi": action = Settings.ACTION_WIFI_SETTINGS; break;
            case "bluetooth": action = Settings.ACTION_BLUETOOTH_SETTINGS; break;
            case "display": action = Settings.ACTION_DISPLAY_SETTINGS; break;
            case "sound": action = Settings.ACTION_SOUND_SETTINGS; break;
            case "battery": action = Settings.ACTION_BATTERY_SAVER_SETTINGS; break;
            case "apps": action = Settings.ACTION_APPLICATION_SETTINGS; break;
            case "permissions": action = Settings.ACTION_APPLICATION_SETTINGS; break;
            case "location": action = Settings.ACTION_LOCATION_SOURCE_SETTINGS; break;
            default: action = Settings.ACTION_SETTINGS;
        }
        try {
            getActivity().startActivity(new Intent(action));
            JSObject result = new JSObject();
            result.put("status", "LAUNCHED");
            result.put("message", "Android Settings activity opened");
            result.put("page", page);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("SETTINGS_ACTIVITY_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        try {
            StatFs stats = new StatFs(Environment.getDataDirectory().getAbsolutePath());
            long available = stats.getAvailableBlocksLong() * stats.getBlockSizeLong();
            long total = stats.getBlockCountLong() * stats.getBlockSizeLong();
            ActivityManager manager = (ActivityManager) getContext().getSystemService(Activity.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
            manager.getMemoryInfo(memory);
            JSObject storage = new JSObject();
            storage.put("availableBytes", available);
            storage.put("totalBytes", total);
            storage.put("availableHuman", humanBytes(available));
            storage.put("totalHuman", humanBytes(total));
            JSObject ram = new JSObject();
            ram.put("availableBytes", memory.availMem);
            ram.put("totalBytes", memory.totalMem);
            ram.put("availableHuman", humanBytes(memory.availMem));
            ram.put("totalHuman", humanBytes(memory.totalMem));
            JSObject result = new JSObject();
            result.put("status", "VERIFIED");
            result.put("source", "Android StatFs and ActivityManager.MemoryInfo");
            result.put("storage", storage);
            result.put("memory", ram);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("DEVICE_DIAGNOSTICS_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void openDialer(PluginCall call) {
        String number = call.getString("number", "");
        if (number == null || !PHONE.matcher(number).matches()) {
            call.reject("INVALID_PHONE_NUMBER");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", number, null));
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "LAUNCHED");
            result.put("message", "Dialer opened; no call was placed");
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("DIALER_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void draftSms(PluginCall call) {
        String recipient = call.getString("recipient", "");
        String body = call.getString("body", "");
        if (recipient == null || !PHONE.matcher(recipient).matches() || TextUtils.isEmpty(body)) {
            call.reject("INVALID_SMS_DRAFT");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.fromParts("smsto", recipient, null));
            intent.putExtra("sms_body", body);
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "DRAFT_OPENED");
            result.put("message", "SMS draft opened; no message was sent");
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("SMS_APP_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void draftEmail(PluginCall call) {
        String recipient = call.getString("recipient", "");
        String body = call.getString("body", "");
        if (recipient == null || !EMAIL.matcher(recipient).matches() || TextUtils.isEmpty(body)) {
            call.reject("INVALID_EMAIL_DRAFT");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + Uri.encode(recipient)));
            intent.putExtra(Intent.EXTRA_SUBJECT, "");
            intent.putExtra(Intent.EXTRA_TEXT, body);
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "DRAFT_OPENED");
            result.put("message", "Email draft opened; no email was sent");
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("EMAIL_APP_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void launchApp(PluginCall call) {
        String packageName = call.getString("packageName", "");
        if (packageName == null || !PACKAGE.matcher(packageName).matches()) {
            call.reject("INVALID_PACKAGE_NAME");
            return;
        }
        try {
            Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(packageName);
            if (launch == null) {
                call.reject("APP_NOT_VISIBLE_OR_NOT_INSTALLED");
                return;
            }
            getActivity().startActivity(launch);
            JSObject result = new JSObject();
            result.put("status", "LAUNCHED");
            result.put("message", "Requested app launch intent accepted");
            result.put("packageName", packageName);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("APP_LAUNCH_UNAVAILABLE");
        }
    }

    @PluginMethod
    public void pickFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(call, intent, "filePickerResult");
    }

    @ActivityCallback
    private void filePickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK ||
                result.getData() == null || result.getData().getData() == null) {
            call.reject("FILE_PICKER_CANCELLED_OR_UNAVAILABLE");
            return;
        }
        Uri uri = result.getData().getData();
        JSObject value = new JSObject();
        value.put("status", "PICKER_OPENED");
        value.put("uri", uri.toString());
        value.put("message", "User selected a file; content was not read");
        call.resolve(value);
    }

    private static String humanBytes(long value) {
        if (value < 1024) return value + " B";
        double amount = value;
        String[] units = {"B", "KB", "MB", "GB", "TB"};
        int unit = 0;
        while (amount >= 1024 && unit < units.length - 1) {
            amount /= 1024;
            unit++;
        }
        return String.format(Locale.ROOT, "%.1f %s", amount, units[unit]);
    }
}
