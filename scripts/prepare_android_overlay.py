#!/usr/bin/env python3
"""Prepare a Capacitor-generated Android project with a movable system-wide MOSHARROF bubble."""
from pathlib import Path

root = Path("android")
manifest = root / "app/src/main/AndroidManifest.xml"
manifest_text = manifest.read_text(encoding="utf-8")

permissions = [
    '  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />',
    '  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
    '  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />',
]
for permission in permissions:
    if permission not in manifest_text:
        manifest_text = manifest_text.replace("<application", permission + "\n  <application", 1)

service_decl = '''    <service
      android:name=".MosharrofOverlayService"
      android:exported="false"
      android:stopWithTask="false"
      android:foregroundServiceType="specialUse">
      <property
        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="user-initiated floating voice assistant overlay" />
    </service>
'''
if "MosharrofOverlayService" not in manifest_text:
    manifest_text = manifest_text.replace("</application>", service_decl + "  </application>", 1)
manifest.write_text(manifest_text, encoding="utf-8")

java_dir = root / "app/src/main/java/com/mosharrof/ai"
java_dir.mkdir(parents=True, exist_ok=True)

(java_dir / "MosharrofOverlayService.java").write_text(r'''package com.mosharrof.ai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

public class MosharrofOverlayService extends Service {
    private static final String CHANNEL = "mosharrof_assistant_overlay";
    private WindowManager windowManager;
    private TextView bubble;
    private WindowManager.LayoutParams params;
    private float downX, downY, startX, startY;
    private boolean dragged;

    @Override public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Intent open = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra("MOSHARROF_START_VOICE", true);
        PendingIntent pending = PendingIntent.getActivity(this, 101, open,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification notification = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle("MOSHARROF AI")
            .setContentText("ভাসমান সহকারী চালু আছে · লুকাতে বুদবুদটি চেপে ধরুন")
            .setContentIntent(pending)
            .setOngoing(true)
            .build();
        startForeground(101, notification);
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return; }
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        bubble = new TextView(this);
        bubble.setText("🎙");
        bubble.setTextSize(19);
        bubble.setTextColor(Color.WHITE);
        bubble.setGravity(Gravity.CENTER);
        bubble.setBackgroundColor(Color.rgb(18, 61, 42));
        bubble.setElevation(12f);
        bubble.setContentDescription("MOSHARROF AI ভয়েস সহকারী");
        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
            dp(48), dp(48), type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = dp(16);
        params.y = dp(220);
        bubble.setOnTouchListener((view, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    downX = event.getRawX(); downY = event.getRawY();
                    startX = params.x; startY = params.y; dragged = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - downX, dy = event.getRawY() - downY;
                    if (Math.abs(dx) > dp(5) || Math.abs(dy) > dp(5)) dragged = true;
                    if (dragged) {
                        params.x = Math.max(0, (int)(startX + dx));
                        params.y = Math.max(0, (int)(startY + dy));
                        try { windowManager.updateViewLayout(bubble, params); } catch (Exception ignored) {}
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!dragged) {
                        if (event.getEventTime() - event.getDownTime() > 650) {
                            getSharedPreferences("mosharrof_overlay", MODE_PRIVATE).edit().putBoolean("enabled", false).apply();
                            stopSelf();
                        } else {
                            Intent launch = new Intent(MosharrofOverlayService.this, MainActivity.class)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                .putExtra("MOSHARROF_START_VOICE", true);
                            startActivity(launch);
                        }
                    }
                    return true;
            }
            return false;
        });
        windowManager.addView(bubble, params);
    }

    private int dp(float value) { return (int)(value * getResources().getDisplayMetrics().density + 0.5f); }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "MOSHARROF floating assistant", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Persistent notification for the movable voice assistant");
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (!Settings.canDrawOverlays(this)) stopSelf();
        return START_STICKY;
    }

    @Override public void onDestroy() {
        if (bubble != null && windowManager != null) {
            try { windowManager.removeView(bubble); } catch (Exception ignored) {}
        }
        bubble = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
''', encoding="utf-8")

(java_dir / "MainActivity.java").write_text(r'''package com.mosharrof.ai;

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import android.app.AlertDialog;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int OVERLAY_REQUEST = 9217;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
        getBridge().getWebView().addJavascriptInterface(new MosharrofBridge(), "MosharrofNative");
        ensureOverlayPermission();
        runVoiceIntent(getIntent());
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        runVoiceIntent(intent);
    }

    @Override protected void onResume() {
        super.onResume();
        if (Settings.canDrawOverlays(this) &&
            getSharedPreferences("mosharrof_overlay", MODE_PRIVATE).getBoolean("enabled", true)) {
            startOverlayService();
        }
    }

    private void ensureOverlayPermission() {
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) {
            new AlertDialog.Builder(this)
                .setTitle("MOSHARROF ভাসমান সহকারী")
                .setMessage("Facebook, YouTube বা Home Screen থেকেও সহকারী ডাকতে Android-এর “Display over other apps” অনুমতি প্রয়োজন।")
                .setNegativeButton("এখন নয়", (d, w) -> {})
                .setPositiveButton("অনুমতি দিন", (d, w) -> {
                    Intent settings = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName()));
                    startActivityForResult(settings, OVERLAY_REQUEST);
                }).show();
        } else if (Settings.canDrawOverlays(this)) {
            startOverlayService();
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == OVERLAY_REQUEST && Settings.canDrawOverlays(this)) {
            getSharedPreferences("mosharrof_overlay", MODE_PRIVATE).edit().putBoolean("enabled", true).apply();
            startOverlayService();
        }
    }

    private void startOverlayService() {
        Intent service = new Intent(this, MosharrofOverlayService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
    }

    private void runVoiceIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("MOSHARROF_START_VOICE", false)) return;
        intent.removeExtra("MOSHARROF_START_VOICE");
        getWindow().getDecorView().postDelayed(() ->
            getBridge().getWebView().evaluateJavascript(
                "(function(){var b=document.getElementById('mosharrofVoiceFab')||document.getElementById('composerVoiceBtn');if(b)b.click();})();",
                null), 800);
    }

    public class MosharrofBridge {
        @JavascriptInterface public void showOverlay() {
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(MainActivity.this)) {
                    ensureOverlayPermission();
                    return;
                }
                getSharedPreferences("mosharrof_overlay", MODE_PRIVATE).edit().putBoolean("enabled", true).apply();
                startOverlayService();
                Toast.makeText(MainActivity.this, "ভাসমান সহকারী চালু", Toast.LENGTH_SHORT).show();
            });
        }
        @JavascriptInterface public void hideOverlay() {
            runOnUiThread(() -> {
                getSharedPreferences("mosharrof_overlay", MODE_PRIVATE).edit().putBoolean("enabled", false).apply();
                stopService(new Intent(MainActivity.this, MosharrofOverlayService.class));
                Toast.makeText(MainActivity.this, "ভাসমান সহকারী লুকানো হয়েছে", Toast.LENGTH_SHORT).show();
            });
        }
        @JavascriptInterface public void openApp(String target) {
            String packageName;
            String fallback;
            switch (target == null ? "" : target.toLowerCase()) {
                case "youtube": packageName = "com.google.android.youtube"; fallback = "https://www.youtube.com"; break;
                case "facebook": packageName = "com.facebook.katana"; fallback = "https://www.facebook.com"; break;
                case "whatsapp": packageName = "com.whatsapp"; fallback = "https://www.whatsapp.com"; break;
                case "chrome": packageName = "com.android.chrome"; fallback = "https://www.google.com"; break;
                case "maps": packageName = "com.google.android.apps.maps"; fallback = "https://maps.google.com"; break;
                default: return;
            }
            runOnUiThread(() -> {
                try {
                    Intent launch = getPackageManager().getLaunchIntentForPackage(packageName);
                    if (launch != null) startActivity(launch);
                    else startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallback)));
                } catch (Exception e) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallback))); } catch (Exception ignored) {}
                }
            });
        }
    }
}
''', encoding="utf-8")
print("Prepared native overlay sources and manifest permissions")
