package com.mosharrof.ai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.view.Display;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/** User-enabled, draggable MOSHARROF voice launcher. It never reads screen contents. */
public final class MosharrofBubbleService extends Service {
    private static final String CHANNEL = "mosharrof_voice_bubble";
    private static final String[] EDGES = {"left", "right", "top", "bottom"};
    private WindowManager windowManager;
    private View bubble;
    private WindowManager.LayoutParams params;
    private boolean expanded = false;
    private String edge = "right";

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
        view.setText("›");
        view.setTextColor(Color.WHITE);
        view.setTextSize(20);
        view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        view.setGravity(Gravity.CENTER);
        view.setBackground(makeBackground(false));
        view.setContentDescription("MOSHARROF AI-তে কথা বলুন");
        int type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
            dp(14), dp(58), type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = screenWidth() - params.width;
        params.y = Math.max(dp(80), (screenHeight() - params.height) / 2);
        view.setOnTouchListener(new View.OnTouchListener() {
            private float downX, downY;
            private int startX, startY;
            private boolean moved;
            @Override public boolean onTouch(View v, MotionEvent event) {
                if (event.getAction() == MotionEvent.ACTION_DOWN) {
                    downX = event.getRawX();
                    downY = event.getRawY();
                    startX = params.x;
                    startY = params.y;
                    moved = false;
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_MOVE) {
                    int dx = (int) (event.getRawX() - downX);
                    int dy = (int) (event.getRawY() - downY);
                    if (Math.abs(dx) + Math.abs(dy) > dp(8)) moved = true;
                    params.x = clamp(startX + dx, 0, Math.max(0, screenWidth() - params.width));
                    params.y = clamp(startY + dy, 0, Math.max(0, screenHeight() - params.height));
                    try { windowManager.updateViewLayout(bubble, params); }
                    catch (RuntimeException ignored) { }
                    return true;
                }
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    if (moved) {
                        snapToNearestEdge();
                    } else if (!expanded) {
                        setBubbleExpanded(true);
                    } else {
                        setBubbleExpanded(false);
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

    private void snapToNearestEdge() {
        if (bubble == null || params == null) return;
        int left = params.x;
        int right = screenWidth() - (params.x + params.width);
        int top = params.y;
        int bottom = screenHeight() - (params.y + params.height);
        int nearest = Math.min(Math.min(left, right), Math.min(top, bottom));
        if (nearest == left) edge = "left";
        else if (nearest == right) edge = "right";
        else if (nearest == top) edge = "top";
        else edge = "bottom";
        setBubbleExpanded(false);
    }

    private void setBubbleExpanded(boolean show) {
        if (bubble == null || params == null || windowManager == null) return;
        expanded = show;
        TextView view = (TextView) bubble;
        params.width = dp(show ? 54 : (isHorizontalEdge() ? 14 : 58));
        params.height = dp(show ? 54 : (isHorizontalEdge() ? 58 : 14));
        positionAtEdge();
        view.setText(show ? "M" : (("left".equals(edge) || "right".equals(edge)) ? "›" : "⌄"));
        view.setTextSize(show ? 18 : 20);
        view.setBackground(makeBackground(show));
        view.setContentDescription(show
            ? "MOSHARROF AI-তে কথা শুরু করুন"
            : "MOSHARROF AI টেনে সরান বা টাচ করে খুলুন");
        try { windowManager.updateViewLayout(bubble, params); }
        catch (RuntimeException ignored) { }
    }

    private GradientDrawable makeBackground(boolean round) {
        GradientDrawable background = new GradientDrawable(
            GradientDrawable.Orientation.TL_BR, new int[] {0xFF00D9FF, 0xFF7655FF});
        if (round) {
            background.setShape(GradientDrawable.OVAL);
        } else {
            background.setShape(GradientDrawable.RECTANGLE);
            float r = dp(16);
            float[] corners = new float[] {r, r, r, r, r, r, r, r};
            if ("left".equals(edge)) corners = new float[] {0, 0, r, r, r, r, 0, 0};
            else if ("right".equals(edge)) corners = new float[] {r, r, 0, 0, 0, 0, r, r};
            else if ("top".equals(edge)) corners = new float[] {0, 0, 0, 0, r, r, r, r};
            else if ("bottom".equals(edge)) corners = new float[] {r, r, r, r, 0, 0, 0, 0};
            background.setCornerRadii(corners);
        }
        background.setStroke(1, 0xCCFFFFFF);
        return background;
    }

    private void positionAtEdge() {
        int maxX = Math.max(0, screenWidth() - params.width);
        int maxY = Math.max(0, screenHeight() - params.height);
        if ("left".equals(edge)) params.x = 0;
        else if ("right".equals(edge)) params.x = maxX;
        else params.x = clamp(params.x, 0, maxX);
        if ("top".equals(edge)) params.y = 0;
        else if ("bottom".equals(edge)) params.y = maxY;
        else params.y = clamp(params.y, 0, maxY);
    }

    private boolean isHorizontalEdge() {
        return "left".equals(edge) || "right".equals(edge);
    }

    private int screenWidth() {
        Display display = windowManager.getDefaultDisplay();
        Point size = new Point();
        display.getRealSize(size);
        return size.x;
    }

    private int screenHeight() {
        Display display = windowManager.getDefaultDisplay();
        Point size = new Point();
        display.getRealSize(size);
        return size.y;
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
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
            try { windowManager.removeView(bubble); } catch (Exception ignored) { }
        }
        bubble = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
