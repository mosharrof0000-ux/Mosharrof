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

/** Safe, user-mediated device controls and opt-in voice companion. */
@CapacitorPlugin(name = "DeviceControl")
public class DeviceControlPlugin extends Plugin {

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        result.put("model", Build.MODEL == null ? "" : Build.MODEL);
        result.put("androidVersion", Build.VERSION.RELEASE == null ? "" : Build.VERSION.RELEASE);
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put("mediatedControlsOnly", true);
        call.resolve(result);
    }

    @PluginMethod public void enableFloatingBubble(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(getContext())) {
            try {
                Intent permission = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(permission);
                JSObject result = new JSObject();
                result.put("enabled", false);
                result.put("permissionRequired", true);
                call.resolve(result);
            } catch (ActivityNotFoundException | SecurityException error) {
                call.reject("ভাসমান বাটনের অনুমতি পৃষ্ঠা খোলা যায়নি।", error);
            }
            return;
        }
        try {
            Intent service = new Intent(getContext(), MosharrofBubbleService.class);
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(service);
            else getContext().startService(service);
            JSObject result = new JSObject();
            result.put("enabled", true);
            result.put("permissionRequired", false);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("ভাসমান বাটন চালু করা যায়নি। অনুমতি ও Android বিজ্ঞপ্তি পরীক্ষা করুন।", error);
        }
    }

    @PluginMethod public void disableFloatingBubble(PluginCall call) {
        boolean stopped = getContext().stopService(
            new Intent(getContext(), MosharrofBubbleService.class));
        JSObject result = new JSObject();
        result.put("stopped", stopped);
        call.resolve(result);
    }

    @PluginMethod public void openWifiSettings(PluginCall call) {
        openSettings(call, Settings.ACTION_WIFI_SETTINGS);
    }
    @PluginMethod public void openBluetoothSettings(PluginCall call) {
        openSettings(call, Settings.ACTION_BLUETOOTH_SETTINGS);
    }
    @PluginMethod public void openAppSettings(PluginCall call) {
        openSettings(call, Settings.ACTION_APPLICATION_SETTINGS);
    }
    @PluginMethod public void openDisplaySettings(PluginCall call) {
        openSettings(call, Settings.ACTION_DISPLAY_SETTINGS);
    }
    @PluginMethod public void openBatterySettings(PluginCall call) {
        openSettings(call, Settings.ACTION_BATTERY_SAVER_SETTINGS);
    }
    @PluginMethod public void openLocationSettings(PluginCall call) {
        openSettings(call, Settings.ACTION_LOCATION_SOURCE_SETTINGS);
    }
    @PluginMethod public void openSoundSettings(PluginCall call) {
        openSettings(call, Settings.ACTION_SOUND_SETTINGS);
    }

    private void openSettings(PluginCall call, String action) {
        try {
            Intent intent = new Intent(action);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("action", action);
            result.put("userMediated", true);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException | IllegalStateException error) {
            call.reject("এই Android সংস্করণে সেটিংস পৃষ্ঠা খোলা যায়নি।", error);
        }
    }
}
