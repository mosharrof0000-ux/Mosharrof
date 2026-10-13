package com.mosharrof.ai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/** User-enabled, dismissible MOSHARROF voice launcher. It never reads screen contents. */
public final class MosharrofBubbleService extends Service {
    private static final String CHANNEL = "mosharrof_voice_bubble";
    private WindowManager windowManager;
    private View bubble;
    private WindowManager.LayoutParams params;

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        Notification notification = builder
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("MOSHARROF AI")
            .setContentText("ভাসমান ভয়েস বাটন চালু আছে")
            .setOngoing(true)
            .build();
        startForeground(7314, notification);
        showBubble();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL,
                "MOSHARROF voice bubble", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Persistent notification for the user-enabled floating voice shortcut.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void showBubble() {
        if (!Settings.canDrawOverlays(this) || bubble != null) return;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        TextView view = new TextView(this);
        view.setText("M");
        view.setTextColor(Color.WHITE);
        view.setTextSize(18);
        view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        view.setGravity(Gravity.CENTER);
        GradientDrawable background = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR, new int[] {0xFF00D9FF, 0xFF7655FF});
        background.setShape(GradientDrawable.OVAL);
        background.setStroke(2, 0xCCFFFFFF);
        view.setBackground(background);
        view.setContentDescription("MOSHARROF AI-তে কথা বলুন");
        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
            dp(54), dp(54), type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.RIGHT | Gravity.CENTER_VERTICAL;
        params.x = dp(5);
        view.setOnTouchListener(new View.OnTouchListener() {
            private float downX, downY;
            private int startX, startY;
            private boolean moved;
            @Override public boolean onTouch(View v, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    downX = event.getRawX(); downY = event.getRawY();
                    startX = params.x; startY = params.y; moved = false; return true;
                }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    int dx = (int) (downX - event.getRawX());
                    int dy = (int) (event.getRawY() - downY);
                    if (Math.abs(dx) + Math.abs(dy) > dp(8)) moved = true;
                    params.x = Math.max(0, startX + dx);
                    params.y = startY + dy;
                    try { windowManager.updateViewLayout(bubble, params); } catch (Exception ignored) {}
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    if (!moved) {
                        Intent intent = new Intent(MosharrofBubbleService.this, MainActivity.class);
                        intent.setAction("com.mosharrof.ai.OPEN_VOICE");
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                        startActivity(intent);
                    }
                    return true;
                }
                return true;
            }
        });
        bubble = view;
        try { windowManager.addView(bubble, params); }
        catch (RuntimeException error) { bubble = null; stopSelf(); }
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (bubble == null) showBubble();
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
