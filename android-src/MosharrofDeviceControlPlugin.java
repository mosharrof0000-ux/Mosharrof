package com.mosharrof.ai;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
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

    private void confirm(PluginCall call, String title, String detail, Runnable approved) {
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            call.reject("ACTIVITY_UNAVAILABLE");
            return;
        }
        activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
            .setTitle(title)
            .setMessage(detail + "\n\nএই কাজটি শুধু এখনকার অনুরোধের জন্য অনুমোদিত হবে।")
            .setNegativeButton("বাতিল", (dialog, which) -> call.reject("USER_CANCELLED"))
            .setPositiveButton("অনুমতি দিন", (dialog, which) -> {
                try {
                    approved.run();
                } catch (Exception error) {
                    call.reject("DEVICE_ACTION_FAILED");
                }
            })
            .setOnCancelListener(dialog -> call.reject("USER_CANCELLED"))
            .show());
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        String page = call.getString("page", "general");
        if (page == null) page = "general";
        final String requestedPage = page;
        String action;
        switch (requestedPage) {
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
        final String requestedAction = action;
        confirm(call, "Android সেটিংস খুলবেন?", "পৃষ্ঠা: " + requestedPage, () -> {
            getActivity().startActivity(new Intent(requestedAction));
            JSObject result = new JSObject();
            result.put("status", "LAUNCHED");
            result.put("message", "Android Settings activity opened");
            result.put("page", requestedPage);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        confirm(call, "সিস্টেম মেট্রিক পড়বেন?", "শুধু মোট/উপলভ্য স্টোরেজ ও RAM-এর প্রকাশ্য Android মেট্রিক", () -> {
            StatFs stats = new StatFs(Environment.getDataDirectory().getAbsolutePath());
            long available = stats.getAvailableBlocksLong() * stats.getBlockSizeLong();
            long total = stats.getBlockCountLong() * stats.getBlockSizeLong();
            ActivityManager manager = (ActivityManager) getContext().getSystemService(Activity.ACTIVITY_SERVICE);
            if (manager == null) throw new IllegalStateException("MEMORY_SERVICE_UNAVAILABLE");
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
        });
    }

    @PluginMethod
    public void openDialer(PluginCall call) {
        String number = call.getString("number", "");
        if (number == null || !PHONE.matcher(number).matches()) {
            call.reject("INVALID_PHONE_NUMBER");
            return;
        }
        final String requestedNumber = number;
        confirm(call, "ডায়ালার খুলবেন?", "নম্বর: " + requestedNumber + "\nমোশাররফ নিজে থেকে কল করবে না।", () -> {
            Intent intent = new Intent(Intent.ACTION_DIAL, Uri.fromParts("tel", requestedNumber, null));
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "LAUNCHED");
            result.put("message", "Dialer opened; no call was placed");
            call.resolve(result);
        });
    }

    @PluginMethod
    public void draftSms(PluginCall call) {
        String recipient = call.getString("recipient", "");
        String body = call.getString("body", "");
        if (recipient == null || !PHONE.matcher(recipient).matches() || TextUtils.isEmpty(body)) {
            call.reject("INVALID_SMS_DRAFT");
            return;
        }
        final String to = recipient;
        final String message = body;
        confirm(call, "SMS খসড়া খুলবেন?", "প্রাপক: " + to + "\nবার্তা:\n" + message + "\nকোনো SMS স্বয়ংক্রিয়ভাবে পাঠানো হবে না।", () -> {
            Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.fromParts("smsto", to, null));
            intent.putExtra("sms_body", message);
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "DRAFT_OPENED");
            result.put("message", "SMS draft opened; no message was sent");
            call.resolve(result);
        });
    }

    @PluginMethod
    public void draftEmail(PluginCall call) {
        String recipient = call.getString("recipient", "");
        String body = call.getString("body", "");
        if (recipient == null || !EMAIL.matcher(recipient).matches() || TextUtils.isEmpty(body)) {
            call.reject("INVALID_EMAIL_DRAFT");
            return;
        }
        final String to = recipient;
        final String message = body;
        confirm(call, "ইমেইল খসড়া খুলবেন?", "প্রাপক: " + to + "\nবার্তা:\n" + message + "\nকোনো ইমেইল স্বয়ংক্রিয়ভাবে পাঠানো হবে না।", () -> {
            Intent intent = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + to));
            intent.putExtra(Intent.EXTRA_SUBJECT, "");
            intent.putExtra(Intent.EXTRA_TEXT, message);
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("status", "DRAFT_OPENED");
            result.put("message", "Email draft opened; no email was sent");
            call.resolve(result);
        });
    }

    @PluginMethod
    public void launchApp(PluginCall call) {
        String packageName = call.getString("packageName", "");
        if (packageName == null || !PACKAGE.matcher(packageName).matches()) {
            call.reject("INVALID_PACKAGE_NAME");
            return;
        }
        final String requestedPackage = packageName;
        confirm(call, "অ্যাপ খুলবেন?", "প্যাকেজ: " + requestedPackage, () -> {
            Intent launch = getContext().getPackageManager().getLaunchIntentForPackage(requestedPackage);
            if (launch == null) {
                call.reject("APP_NOT_VISIBLE_OR_NOT_INSTALLED");
                return;
            }
            getActivity().startActivity(launch);
            JSObject result = new JSObject();
            result.put("status", "LAUNCHED");
            result.put("message", "Requested app launch intent accepted");
            result.put("packageName", requestedPackage);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void pickFile(PluginCall call) {
        confirm(call, "ফাইল বাছাই করবেন?", "Android-এর ফাইল পিকার খুলবে। আপনি যে ফাইলটি বাছবেন শুধু তার URI ফেরত আসবে; কোনো ফাইলের বিষয়বস্তু পড়া বা পরিবর্তন হবে না।", () -> {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            startActivityForResult(call, intent, "filePickerResult");
        });
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
