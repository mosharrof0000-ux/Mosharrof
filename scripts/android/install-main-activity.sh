#!/usr/bin/env bash
set -euo pipefail

cp native/android/DeviceControlPlugin.java android/app/src/main/java/com/mosharrof/ai/DeviceControlPlugin.java
cp native/android/FloatingChatPlugin.java android/app/src/main/java/com/mosharrof/ai/FloatingChatPlugin.java
cp native/android/AndroidAccessibilityPlugin.java android/app/src/main/java/com/mosharrof/ai/AndroidAccessibilityPlugin.java
cp native/android/AndroidFileManagerPlugin.java android/app/src/main/java/com/mosharrof/ai/AndroidFileManagerPlugin.java
cp native/android/AndroidMediaOrganizerPlugin.java android/app/src/main/java/com/mosharrof/ai/AndroidMediaOrganizerPlugin.java
cp native/android/AndroidDuplicateScanner.java android/app/src/main/java/com/mosharrof/ai/AndroidDuplicateScanner.java

cat > android/app/src/main/java/com/mosharrof/ai/MainActivity.java <<'JAVA'
package com.mosharrof.ai;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.database.Cursor;
import android.provider.ContactsContract;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final int OVERLAY_REQUEST = 5805;
    private static final int RUNTIME_PERMISSION_REQUEST = 5807;
    private static boolean askedForOverlayThisSession = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String[] requiredPermissions;
    private int permissionIndex = 0;

    @Override protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceControlPlugin.class);
        registerPlugin(FloatingChatPlugin.class);
        registerPlugin(AndroidAccessibilityPlugin.class);
        registerPlugin(AndroidFileManagerPlugin.class);
        registerPlugin(AndroidMediaOrganizerPlugin.class);
        super.onCreate(savedInstanceState);
        // Enable remote inspection only for debug APKs so CI can test the installed WebView.
        if (BuildConfig.DEBUG) android.webkit.WebView.setWebContentsDebuggingEnabled(true);
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.setNavigationBarContrastEnforced(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
            window.setAttributes(lp);
        }
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            int nightMode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            boolean lightTheme = nightMode != Configuration.UI_MODE_NIGHT_YES;
            controller.setAppearanceLightStatusBars(lightTheme);
            controller.setAppearanceLightNavigationBars(lightTheme);
        }
        handleVoiceIntent(getIntent());
        beginPermissionSetup();

    }

    @Override public void onResume() {
        super.onResume();
        if (Settings.canDrawOverlays(this)) startVoiceOverlay();
    }

    private void beginPermissionSetup() {
        if (getPreferences(MODE_PRIVATE).getBoolean("permission_setup_done", false)) {
            continueOverlaySetup();
            return;
        }
        java.util.ArrayList<String> list = new java.util.ArrayList<>();
        list.add(Manifest.permission.RECORD_AUDIO);
        list.add(Manifest.permission.READ_CONTACTS);
        list.add(Manifest.permission.CALL_PHONE);
        if (Build.VERSION.SDK_INT >= 33) list.add(Manifest.permission.POST_NOTIFICATIONS);
        requiredPermissions = list.toArray(new String[0]);
        permissionIndex = 0;
        requestNextPermission();
    }

    private void requestNextPermission() {
        while (requiredPermissions != null && permissionIndex < requiredPermissions.length) {
            String permission = requiredPermissions[permissionIndex++];
            if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) continue;
            String explanation;
            if (Manifest.permission.RECORD_AUDIO.equals(permission)) explanation = "কণ্ঠে নির্দেশ শুনতে মাইক্রোফোন অনুমতি দিন।";
            else if (Manifest.permission.READ_CONTACTS.equals(permission)) explanation = "নাম বলে পরিচিত কাউকে খুঁজতে Contacts অনুমতি দিন।";
            else if (Manifest.permission.CALL_PHONE.equals(permission)) explanation = "আপনার নির্দেশে ফোন কল শুরু করার সুবিধার জন্য Phone অনুমতি দিন।";
            else explanation = "ভয়েস ম্যানেজারের চলমান অবস্থা ও নিয়ন্ত্রণ দেখাতে Notifications অনুমতি দিন।";
            new AlertDialog.Builder(this)
                .setTitle("MOSHARROF অনুমতি")
                .setMessage(explanation + "\\n\\nআপনি চাইলে অনুমতি প্রত্যাখ্যান করতে পারেন; সংশ্লিষ্ট সুবিধাটি তখন কাজ নাও করতে পারে।")
                .setPositiveButton("পরবর্তী", (dialog, which) -> requestPermissions(new String[]{permission}, RUNTIME_PERMISSION_REQUEST))
                .setNegativeButton("এখন নয়", (dialog, which) -> requestNextPermission())
                .setOnCancelListener(dialog -> requestNextPermission())
                .show();
            return;
        }
        getPreferences(MODE_PRIVATE).edit().putBoolean("permission_setup_done", true).apply();
        requiredPermissions = null;
        continueOverlaySetup();
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == RUNTIME_PERMISSION_REQUEST) {
            requestNextPermission();
        }
    }

    private void continueOverlaySetup() {
        if (Settings.canDrawOverlays(this)) startVoiceOverlay();
        else if (!askedForOverlayThisSession) {
            askedForOverlayThisSession = true;
            new AlertDialog.Builder(this)
              .setTitle("MOSHARROF ভয়েস ম্যানেজার")
              .setMessage("হোমস্ক্রিন ও অন্য অ্যাপের ওপর ছোট ভাসমান মাইক্রোফোন ব্যবহার করতে 'Display over other apps' বিশেষ অনুমতি দিন। Android নিরাপত্তার কারণে এটি Settings থেকে চালু করতে হয়।")
              .setPositiveButton("Settings খুলুন", (d, w) -> {
                  Intent permission = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
                  try { startActivityForResult(permission, OVERLAY_REQUEST); }
                  catch (Exception e) { startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)); }
              })
              .setNegativeButton("এখন নয়", (d, w) -> {})
              .show();
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OVERLAY_REQUEST && Settings.canDrawOverlays(this)) startVoiceOverlay();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleVoiceIntent(intent);
    }

    private void startVoiceOverlay() {
        Intent service = new Intent(this, VoiceOverlayService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
    }

    private void handleVoiceIntent(Intent intent) {
        if (intent == null) return;
        if (intent.getBooleanExtra("mosharrof_start_chat_voice", false)) {
            intent.removeExtra("mosharrof_start_chat_voice");
            deliverStartChatVoice(0);
            return;
        }
        String command = intent.getStringExtra("mosharrof_voice_command");
        if (command == null || command.trim().isEmpty()) return;
        intent.removeExtra("mosharrof_voice_command");
        deliverVoiceCommand(command.trim(), 0);
    }

    private void deliverStartChatVoice(int attempt) {
        if (attempt > 30 || isFinishing()) return;
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                String js = "(function(){var button=document.getElementById('composerVoiceBtn');if(button){button.click();return true;}return false;})()";
                getBridge().getWebView().evaluateJavascript(js, value -> {
                    if (!"true".equals(value)) handler.postDelayed(() -> deliverStartChatVoice(attempt + 1), 350);
                });
                return;
            }
        } catch (Exception ignored) {}
        handler.postDelayed(() -> deliverStartChatVoice(attempt + 1), 350);
    }

    private void deliverVoiceCommand(String command, int attempt) {
        if (attempt > 30 || isFinishing()) return;
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                String js = "(function(){if(window.mosharrofNativeVoiceCommand){window.mosharrofNativeVoiceCommand(" + JSONObject.quote(command) + ");return true;}return false;})()";
                getBridge().getWebView().evaluateJavascript(js, value -> {
                    if (!"true".equals(value)) handler.postDelayed(() -> deliverVoiceCommand(command, attempt + 1), 350);
                });
                return;
            }
        } catch (Exception ignored) {}
        handler.postDelayed(() -> deliverVoiceCommand(command, attempt + 1), 350);
    }
}
JAVA
set -x
grep -q 'WindowCompat.setDecorFitsSystemWindows' android/app/src/main/java/com/mosharrof/ai/MainActivity.java
grep -q 'FLAG_DEBUGGABLE.*WebView.setWebContentsDebuggingEnabled(true)' android/app/src/main/java/com/mosharrof/ai/MainActivity.java
grep -q 'android:name=".VoiceOverlayService"' android/app/src/main/AndroidManifest.xml
grep -q 'android.permission.SYSTEM_ALERT_WINDOW' android/app/src/main/AndroidManifest.xml
grep -q 'android.permission.READ_CONTACTS' android/app/src/main/AndroidManifest.xml
grep -q 'android.permission.CALL_PHONE' android/app/src/main/AndroidManifest.xml
grep -q 'beginPermissionSetup' android/app/src/main/java/com/mosharrof/ai/MainActivity.java
grep -q 'isCallCommand' android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java
grep -q 'ContactsContract.CommonDataKinds.Phone.CONTENT_URI' android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java
grep -q 'Intent.ACTION_CALL' android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java
grep -q 'requestNextPermission' android/app/src/main/java/com/mosharrof/ai/MainActivity.java
grep -q 'windowManager.updateViewLayout' android/app/src/main/java/com/mosharrof/ai/VoiceOverlayService.java
grep -q 'getBoolean("hidden", false)' android/app/src/main/java/com/mosharrof/ai/VoiceOverlayService.java
grep -q 'putBoolean("hidden", true)' android/app/src/main/java/com/mosharrof/ai/VoiceOverlayService.java
grep -q 'mosharrofNativeVoiceCommand' android/app/src/main/java/com/mosharrof/ai/MainActivity.java
grep -q 'class VoiceQuickSettingsTile' android/app/src/main/java/com/mosharrof/ai/VoiceQuickSettingsTile.java
grep -q 'onRmsChanged' android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java
grep -q 'requestPermissions(new String\[\]{Manifest.permission.RECORD_AUDIO}' android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java
grep -q 'checkSelfPermission(Manifest.permission.RECORD_AUDIO)' android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java
grep -q 'ERROR_INSUFFICIENT_PERMISSIONS' android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java
grep -q 'setVoiceLevel' android/app/src/main/java/com/mosharrof/ai/VoiceOverlayService.java
echo "Native Android edge-to-edge + global voice manager: PASS"
