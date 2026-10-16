package com.mosharrof.ai;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Safe, user-mediated device controls. All changes are completed by the owner in Android Settings. */
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
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("userMediated", true);
            call.resolve(result);
        } catch (ActivityNotFoundException | SecurityException error) {
            call.reject("এই Android সংস্করণে সেটিংস পৃষ্ঠা খোলা যায়নি।", error);
        }
    }
}
