#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
from pathlib import Path
manifest = Path("android/app/src/main/AndroidManifest.xml")
xml = manifest.read_text(encoding="utf-8")
queries = """
<queries>
    <package android:name="com.google.android.youtube" />
    <package android:name="com.facebook.katana" />
    <package android:name="com.instagram.android" />
    <package android:name="com.whatsapp" />
    <package android:name="com.android.chrome" />
    <package android:name="com.zhiliaoapp.musically" />
    <package android:name="com.google.android.apps.maps" />
    <package android:name="com.google.android.gm" />
    <intent>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent>
</queries>
"""
if "<queries>" not in xml:
  xml = xml.replace("<application", queries + "\n    <application", 1)
permissions = [
  '    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />',
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />',
  '    <uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '    <uses-permission android:name="android.permission.READ_CONTACTS" />',
  '    <uses-permission android:name="android.permission.CALL_PHONE" />',
  '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
]
for item in permissions:
  if item not in xml:
    xml = xml.replace("<application", item + "\n    <application", 1)
launcher_queries = """  <queries>
    <intent>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent>
</queries>
"""
if "<queries>" not in xml:
  xml = xml.replace("<application", launcher_queries + "\n    <application", 1)
components = """
    <activity
        android:name=".VoiceCommandActivity"
        android:exported="false"
        android:excludeFromRecents="true"
        android:theme="@android:style/Theme.Translucent.NoTitleBar" />
    <service
        android:name=".VoiceQuickSettingsTile"
        android:label="MOSHARROF Voice"
        android:icon="@android:drawable/ic_btn_speak_now"
        android:permission="android.permission.BIND_QUICK_SETTINGS_TILE"
        android:exported="true">
        <intent-filter>
            <action android:name="android.service.quicksettings.action.QS_TILE" />
        </intent-filter>
    </service>
    <service
        android:name=".VoiceOverlayService"
        android:exported="false"
        android:foregroundServiceType="specialUse">
        <property
            android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
            android:value="User-enabled movable MOSHARROF voice manager overlay" />
    </service>
"""
if 'android:name=".VoiceOverlayService"' not in xml:
  xml = xml.replace("</application>", components + "\n</application>", 1)
manifest.write_text(xml, encoding="utf-8")
PY
mkdir -p android/app/src/main/java/com/mosharrof/ai
cat > android/app/src/main/java/com/mosharrof/ai/VoiceOverlayService.java <<'JAVA'
package com.mosharrof.ai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;
import android.widget.Toast;

public class VoiceOverlayService extends Service {
    private static VoiceOverlayService activeInstance;
    private float lastAudioLevel = 0f;
    public static void setVoiceListening(boolean value) {
        if (activeInstance != null && activeInstance.bubble != null) activeInstance.bubble.setListening(value);
    }
    public static void setVoiceLevel(float rmsDb) {
        if (activeInstance == null || activeInstance.bubble == null) return;
        float normalized = Math.max(0f, Math.min(1f, (rmsDb + 2f) / 12f));
        activeInstance.lastAudioLevel = normalized;
        activeInstance.bubble.setAudioLevel(normalized);
    }
    public static void setVoiceError() {
        if (activeInstance != null && activeInstance.bubble != null) activeInstance.bubble.setError(true);
    }
    public static void setVoiceSuccess() {
        if (activeInstance != null && activeInstance.bubble != null) {
            activeInstance.bubble.setListening(false);
            activeInstance.bubble.setError(false);
        }
    }
    public static void setPartialTranscript(String ignored) {}
    private static final String CHANNEL = "mosharrof_voice_manager";
    private static final int NOTIFICATION_ID = 5801;
    private static final String ACTION_STOP = "com.mosharrof.ai.STOP_VOICE_OVERLAY";
    private WindowManager windowManager;
    private MicBubbleView bubble;
    private WindowManager.LayoutParams params;
    private boolean compact = false;
    private boolean hidden = false;
    private long downAt;
    private float downRawX, downRawY;
    private int startX, startY;
    private boolean moved;

    @Override public void onCreate() {
        super.onCreate();
        activeInstance = this;
        createChannel();
        hidden = getSharedPreferences("mosharrof_voice_overlay", MODE_PRIVATE).getBoolean("hidden", false);
        startForeground(NOTIFICATION_ID, notification());
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "MOSHARROF ভাসমান বাটনের জন্য Display over other apps অনুমতি দিন", Toast.LENGTH_LONG).show();
            stopSelf();
        } else if (!hidden) {
            showBubble();
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        // startForegroundService() may be called again when MainActivity resumes. Every
        // start command must refresh foreground state immediately or Android can kill the app.
        startForeground(NOTIFICATION_ID, notification());
        String action = intent == null ? null : intent.getAction();
        if ("com.mosharrof.ai.HIDE_VOICE_OVERLAY".equals(action)) {
            hidden = true;
            getSharedPreferences("mosharrof_voice_overlay", MODE_PRIVATE).edit().putBoolean("hidden", true).apply();
            removeBubble();
            startForeground(NOTIFICATION_ID, notification());
            return START_STICKY;
        }
        if ("com.mosharrof.ai.SHOW_VOICE_OVERLAY".equals(action)) {
            hidden = false;
            getSharedPreferences("mosharrof_voice_overlay", MODE_PRIVATE).edit().putBoolean("hidden", false).apply();
            if (Settings.canDrawOverlays(this) && bubble == null) showBubble();
            startForeground(NOTIFICATION_ID, notification());
            return START_STICKY;
        }
        if (ACTION_STOP.equals(action)) {
            removeBubble();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (Settings.canDrawOverlays(this) && bubble == null && !hidden) showBubble();
        return START_STICKY;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "MOSHARROF Voice Manager", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Notification to keep the user-enabled floating voice manager available");
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    private Notification notification() {
        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 5802, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent toggle = new Intent(this, VoiceOverlayService.class).setAction(hidden ? "com.mosharrof.ai.SHOW_VOICE_OVERLAY" : "com.mosharrof.ai.HIDE_VOICE_OVERLAY");
        PendingIntent togglePi = PendingIntent.getService(this, 5803, toggle, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("MOSHARROF Voice Manager")
         .setContentText(hidden ? "ভাসমান মাইক্রোফোন লুকানো আছে" : "ভাসমান মাইক্রোফোন চালু আছে")
         .setContentIntent(openPi).setOngoing(true).addAction(android.R.drawable.ic_menu_view, hidden ? "দেখান" : "লুকান", togglePi);
        return b.build();
    }

    private void showBubble() {
        if (bubble != null) return;
        windowManager = (WindowManager)getSystemService(WINDOW_SERVICE);
        bubble = new MicBubbleView(this);
        bubble.setContentDescription("MOSHARROF ভয়েস ম্যানেজার");
        bubble.setElevation(dp(8));
        params = new WindowManager.LayoutParams(dp(36), dp(36),
            Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        android.content.SharedPreferences savedPosition = getSharedPreferences("mosharrof_voice_overlay", MODE_PRIVATE);
        params.x = savedPosition.getInt("x", dp(12)); params.y = savedPosition.getInt("y", dp(220));
        bubble.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    downAt = System.currentTimeMillis(); downRawX = event.getRawX(); downRawY = event.getRawY();
                    startX = params.x; startY = params.y; moved = false; return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - downRawX, dy = event.getRawY() - downRawY;
                    if (Math.abs(dx) > dp(5) || Math.abs(dy) > dp(5)) moved = true;
                    if (moved) { params.x = Math.max(0, startX + (int)dx); params.y = Math.max(0, startY + (int)dy); try { windowManager.updateViewLayout(bubble, params); } catch (Exception ignored) {} }
                    return true;
                case MotionEvent.ACTION_UP:
                    long held = System.currentTimeMillis() - downAt;
                    if (moved) getSharedPreferences("mosharrof_voice_overlay", MODE_PRIVATE).edit().putInt("x", params.x).putInt("y", params.y).apply();
                    if (!moved && held >= 650) {
                        hidden = true;
                        getSharedPreferences("mosharrof_voice_overlay", MODE_PRIVATE).edit().putBoolean("hidden", true).apply();
                        Toast.makeText(VoiceOverlayService.this, "MOSHARROF আইকন লুকানো হয়েছে · নোটিফিকেশনের ‘দেখান’ চাপলে ফিরবে", Toast.LENGTH_LONG).show();
                        removeBubble();
                        startForeground(NOTIFICATION_ID, notification());
                    }
                    else if (!moved) {
                        if (compact) { compact = false; styleBubble(); }
                        else { Intent voice = new Intent(VoiceOverlayService.this, VoiceCommandActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(voice); }
                    }
                    return true;
            }
            return true;
        });
        try { windowManager.addView(bubble, params); } catch (Exception e) { bubble = null; stopSelf(); }
    }

    private void toggleCompact() {
        compact = !compact;
        styleBubble();
        Toast.makeText(this, compact ? "ম্যানেজার ছোট করা হয়েছে · ট্যাপ করলে আবার খুলবে" : "ভয়েস ম্যানেজার প্রস্তুত", Toast.LENGTH_SHORT).show();
    }

    private void styleBubble() {
        if (bubble == null || params == null) return;
        params.width = dp(compact ? 16 : 36); params.height = dp(compact ? 30 : 36);
        bubble.setCompact(compact);
        try { windowManager.updateViewLayout(bubble, params); } catch (Exception ignored) {}
    }


    private final class MicBubbleView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private boolean isCompact;
        private boolean listening = false;
        private boolean error = false;
        private float audioLevel = 0f;
        MicBubbleView(android.content.Context context) { super(context); setWillNotDraw(false); }
        void setCompact(boolean value) { isCompact = value; invalidate(); }
        void setListening(boolean value) { listening = value; if (value) error = false; invalidate(); }
        void setError(boolean value) { error = value; listening = false; invalidate(); }
        void setAudioLevel(float value) { audioLevel = Math.max(0f, Math.min(1f, value)); invalidate(); }
        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float w = getWidth(), h = getHeight();
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(isCompact ? Color.rgb(45,45,45) : Color.rgb(8,8,8));
            canvas.drawRoundRect(new RectF(0, 0, w, h), dp(isCompact ? 8 : 10), dp(isCompact ? 8 : 10), paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(dp(1));
            paint.setColor(Color.argb(105,255,255,255));
            canvas.drawRoundRect(new RectF(dp(1)/2f, dp(1)/2f, w-dp(1)/2f, h-dp(1)/2f), dp(isCompact ? 8 : 10), dp(isCompact ? 8 : 10), paint);
            if (isCompact) {
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(Color.WHITE);
                canvas.drawCircle(w/2f, h/2f, dp(2), paint);
                return;
            }
            paint.setColor(error ? Color.rgb(255,69,69) : (listening ? Color.rgb(74,222,128) : Color.WHITE));
            paint.setStrokeWidth(dp(2));
            paint.setStrokeCap(Paint.Cap.ROUND);
            paint.setStyle(Paint.Style.STROKE);
            canvas.drawRoundRect(new RectF(w*.40f, h*.20f, w*.60f, h*.57f), dp(5), dp(5), paint);
            canvas.drawArc(new RectF(w*.25f, h*.31f, w*.75f, h*.75f), 0, 180, false, paint);
            canvas.drawLine(w*.50f, h*.75f, w*.50f, h*.86f, paint);
            canvas.drawLine(w*.38f, h*.86f, w*.62f, h*.86f, paint);
            if (listening) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(dp(2));
                paint.setStrokeCap(Paint.Cap.ROUND);
                float[] heights = new float[] {0.18f,0.30f,0.45f,0.62f,0.48f,0.32f,0.20f};
                for (int i=0;i<heights.length;i++) {
                    float level = Math.max(0.10f, Math.min(1f, audioLevel));
                    float bar = dp(3) + dp(11) * heights[i] * level;
                    float x = w*.23f + i*w*.09f;
                    canvas.drawLine(x, h*.5f-bar*.5f, x, h*.5f+bar*.5f, paint);
                }
            }
        }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void removeBubble() { if (windowManager != null && bubble != null) { try { windowManager.removeView(bubble); } catch (Exception ignored) {} } bubble = null; }
    @Override public void onDestroy() { removeBubble(); if (activeInstance == this) activeInstance = null; super.onDestroy(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
JAVA

# Enable Android's native picture-in-picture window for the existing MainActivity.
python - <<'PY'
from pathlib import Path
path = Path("android/app/src/main/AndroidManifest.xml")
xml = path.read_text(encoding="utf-8")
start = 0
tag = None
while True:
    start = xml.find("<activity", start)
    if start < 0:
        break
    end = xml.find(">", start)
    if end < 0:
        break
    candidate = xml[start:end + 1]
    if 'android:name=".MainActivity"' in candidate:
        tag = candidate
        break
    start = end + 1
if tag is None:
    raise SystemExit("MainActivity manifest declaration not found")
updated = tag
for name, value in (("android:supportsPictureInPicture", "true"), ("android:resizeableActivity", "true")):
    if name not in updated:
        updated = updated[:-1] + f' {name}="{value}">'
xml = xml.replace(tag, updated, 1)
path.write_text(xml, encoding="utf-8")
print("Native floating chat PiP manifest: PASS")
PY
