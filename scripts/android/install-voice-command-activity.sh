#!/usr/bin/env bash
set -euo pipefail

cat > android/app/src/main/java/com/mosharrof/ai/VoiceCommandActivity.java <<'JAVA'
package com.mosharrof.ai;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.widget.Toast;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.provider.ContactsContract;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class VoiceCommandActivity extends Activity implements RecognitionListener {
    private SpeechRecognizer recognizer;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final StringBuilder transcript = new StringBuilder();
    private android.widget.TextView transcriptView;
    private android.widget.TextView statusView;
    private android.widget.Button pauseButton;
    private String currentPartial = "";
    private boolean completed = false;
    private boolean paused = false;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        buildControls();
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 5806);
            if (statusView != null) statusView.setText("মাইক্রোফোনের অনুমতি প্রয়োজন। একবার অনুমতি দিন।");
            return;
        }
        initializeVoice();
    }

    private void initializeVoice() {
        if (completed || isFinishing()) return;
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            VoiceOverlayService.setVoiceError();
            if (statusView != null) statusView.setText("মাইক্রোফোনের অনুমতি নেই। অ্যাপের Settings থেকে Microphone অনুমতি চালু করুন।");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            VoiceOverlayService.setVoiceError();
            if (statusView != null) statusView.setText("এই ডিভাইসে voice recognition পাওয়া যায়নি।");
            Toast.makeText(this, "এই ডিভাইসে voice recognition পাওয়া যায়নি।", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            if (recognizer != null) recognizer.destroy();
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(this);
            paused = false;
            startSegment();
        } catch (SecurityException e) {
            VoiceOverlayService.setVoiceError();
            if (statusView != null) statusView.setText("মাইক্রোফোন ব্যবহার করা যাচ্ছে না। অনুমতি যাচাই করে আবার চেষ্টা করুন।");
        } catch (Exception e) {
            VoiceOverlayService.setVoiceError();
            if (statusView != null) statusView.setText("ভয়েস চালু করা যায়নি। আবার চেষ্টা করুন।");
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != 5806) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            initializeVoice();
            return;
        }
        paused = true;
        VoiceOverlayService.setVoiceError();
        if (statusView != null) statusView.setText("মাইক্রোফোনের অনুমতি দেওয়া হয়নি। Settings থেকে Microphone চালু করে আবার খুলুন।");
        boolean canAskAgain = Build.VERSION.SDK_INT < 23 || shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO);
        if (!canAskAgain) {
            new android.app.AlertDialog.Builder(this)
                .setTitle("মাইক্রোফোন অনুমতি")
                .setMessage("অনুমতি বন্ধ আছে। ফোনের Settings → Apps → MOSHARROF AI → Permissions → Microphone থেকে অনুমতি চালু করুন।")
                .setPositiveButton("Settings খুলুন", (dialog, which) -> {
                    Intent settings = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        android.net.Uri.parse("package:" + getPackageName()));
                    startActivity(settings);
                })
                .setNegativeButton("পরে", (dialog, which) -> {})
                .show();
        }
    }

    private void buildControls() {
        android.widget.LinearLayout root = new android.widget.LinearLayout(this);
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setPadding(dpUi(20), dpUi(24), dpUi(20), dpUi(24));
        root.setBackgroundColor(android.graphics.Color.rgb(15, 16, 19));
        android.widget.TextView title = new android.widget.TextView(this);
        title.setText("MOSHARROF AI · ভয়েস");
        title.setTextColor(android.graphics.Color.WHITE);
        title.setTextSize(20);
        title.setPadding(0, 0, 0, dpUi(10));
        root.addView(title);
        statusView = new android.widget.TextView(this);
        statusView.setText("শুরু হচ্ছে…");
        statusView.setTextColor(android.graphics.Color.rgb(74, 222, 128));
        statusView.setTextSize(14);
        statusView.setPadding(0, 0, 0, dpUi(12));
        root.addView(statusView);
        transcriptView = new android.widget.TextView(this);
        transcriptView.setText("আপনার কথা এখানে দেখা যাবে। ভুল হলে ‘আবার বলুন’ চাপুন; পাঠানোর আগে ‘থামুন’ দিয়ে থামাতে পারেন।");
        transcriptView.setTextColor(android.graphics.Color.WHITE);
        transcriptView.setTextSize(17);
        transcriptView.setPadding(dpUi(12), dpUi(12), dpUi(12), dpUi(12));
        transcriptView.setBackgroundColor(android.graphics.Color.rgb(35, 36, 40));
        android.widget.LinearLayout.LayoutParams transcriptParams = new android.widget.LinearLayout.LayoutParams(-1, 0, 1f);
        transcriptParams.bottomMargin = dpUi(18);
        root.addView(transcriptView, transcriptParams);

        android.widget.LinearLayout row1 = new android.widget.LinearLayout(this);
        row1.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        pauseButton = makeButton("থামুন");
        pauseButton.setOnClickListener(v -> togglePause());
        row1.addView(pauseButton, new android.widget.LinearLayout.LayoutParams(0, dpUi(48), 1f));
        android.widget.Button repeat = makeButton("আবার বলুন");
        repeat.setOnClickListener(v -> repeatSpeech());
        android.widget.LinearLayout.LayoutParams repeatParams = new android.widget.LinearLayout.LayoutParams(0, dpUi(48), 1f);
        repeatParams.leftMargin = dpUi(8);
        row1.addView(repeat, repeatParams);
        root.addView(row1);

        android.widget.LinearLayout row2 = new android.widget.LinearLayout(this);
        row2.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        android.widget.Button cancel = makeButton("বাতিল");
        cancel.setOnClickListener(v -> cancelSpeech());
        row2.addView(cancel, new android.widget.LinearLayout.LayoutParams(0, dpUi(48), 1f));
        android.widget.Button send = makeButton("পাঠান");
        send.setOnClickListener(v -> submitTranscript());
        android.widget.LinearLayout.LayoutParams sendParams = new android.widget.LinearLayout.LayoutParams(0, dpUi(48), 1f);
        sendParams.leftMargin = dpUi(8);
        row2.addView(send, sendParams);
        android.widget.LinearLayout.LayoutParams row2Params = new android.widget.LinearLayout.LayoutParams(-1, -2);
        row2Params.topMargin = dpUi(8);
        root.addView(row2, row2Params);
        setContentView(root);
    }

    private android.widget.Button makeButton(String label) {
        android.widget.Button button = new android.widget.Button(this);
        button.setText(label);
        button.setTextSize(14);
        return button;
    }

    private int dpUi(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private Intent speechIntent() {
        Intent speech = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "bn-BD");
        speech.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "bn-BD");
        speech.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        speech.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        speech.putExtra(RecognizerIntent.EXTRA_PROMPT, "MOSHARROF-কে বলুন");
        return speech;
    }

    private void startSegment() {
        if (completed || paused) return;
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            VoiceOverlayService.setVoiceError();
            if (statusView != null) statusView.setText("মাইক্রোফোন অনুমতি নেই। অনুমতি দিয়ে আবার চালু করুন।");
            return;
        }
        if (recognizer == null) {
            initializeVoice();
            return;
        }
        currentPartial = "";
        updateTranscriptView();
        statusView.setText("শুনছি… কথা চলার সময় লেখা এখানে দেখা যাবে");
        VoiceOverlayService.setVoiceListening(true);
        try { recognizer.startListening(speechIntent()); }
        catch (Exception e) {
            paused = true;
            statusView.setText("মাইক্রোফোন চালু হয়নি। আবার চালু চাপুন।");
            pauseButton.setText("আবার চালু");
            VoiceOverlayService.setVoiceError();
        }
    }

    private void togglePause() {
        if (completed) return;
        if (!paused) {
            paused = true;
            statusView.setText("থামানো হয়েছে। চালিয়ে যেতে ‘আবার চালু’ চাপুন।");
            pauseButton.setText("আবার চালু");
            VoiceOverlayService.setVoiceListening(false);
            try { if (recognizer != null) recognizer.stopListening(); } catch (Exception ignored) {}
        } else {
            paused = false;
            pauseButton.setText("থামুন");
            startSegment();
        }
    }

    private void repeatSpeech() {
        if (completed) return;
        transcript.setLength(0);
        currentPartial = "";
        paused = false;
        pauseButton.setText("থামুন");
        try { if (recognizer != null) recognizer.cancel(); } catch (Exception ignored) {}
        updateTranscriptView();
        handler.postDelayed(this::startSegment, 180);
    }

    private void cancelSpeech() {
        if (completed) return;
        completed = true;
        paused = true;
        try { if (recognizer != null) recognizer.cancel(); } catch (Exception ignored) {}
        VoiceOverlayService.setVoiceListening(false);
        VoiceOverlayService.setVoiceSuccess();
        Toast.makeText(this, "কথা বাতিল করা হয়েছে; সার্ভারে পাঠানো হয়নি।", Toast.LENGTH_SHORT).show();
        finish();
    }

    private void updateTranscriptView() {
        if (transcriptView == null) return;
        String committed = transcript.toString().trim();
        String preview = currentPartial == null ? "" : currentPartial.trim();
        String shown = (committed + (committed.isEmpty() || preview.isEmpty() ? "" : " ") + preview).trim();
        transcriptView.setText(shown.isEmpty() ? "আপনার কথা এখানে দেখা যাবে।" : shown);
    }

    @Override public void onReadyForSpeech(Bundle params) { VoiceOverlayService.setVoiceListening(true); }
    @Override public void onBeginningOfSpeech() {
        VoiceOverlayService.setVoiceListening(true);
        if (statusView != null) statusView.setText("শুনছি…");
    }
    @Override public void onRmsChanged(float rmsdB) { VoiceOverlayService.setVoiceLevel(rmsdB); }
    @Override public void onBufferReceived(byte[] buffer) {}
    @Override public void onEndOfSpeech() { VoiceOverlayService.setVoiceListening(false); }
    @Override public void onPartialResults(Bundle partialResults) {
        ArrayList<String> results = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (results != null && !results.isEmpty()) {
            currentPartial = results.get(0);
            updateTranscriptView();
        }
    }
    @Override public void onEvent(int eventType, Bundle params) {}

    @Override public void onError(int error) {
        if (completed || paused) return;
        VoiceOverlayService.setVoiceListening(false);
        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
            paused = true;
            VoiceOverlayService.setVoiceError();
            if (statusView != null) statusView.setText("Android মাইক্রোফোন অনুমতি দেয়নি। Settings → Apps → MOSHARROF AI → Permissions → Microphone যাচাই করুন।");
            return;
        }
        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
            statusView.setText("আরও বলুন… না হলে ‘পাঠান’ চাপুন।");
            handler.postDelayed(this::startSegment, 300);
        } else {
            paused = true;
            pauseButton.setText("আবার চালু");
            statusView.setText("ভয়েস সংযোগে সমস্যা। আবার চালু করে চেষ্টা করুন।");
            VoiceOverlayService.setVoiceError();
        }
    }

    @Override public void onResults(Bundle results) {
        if (completed) return;
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches != null && !matches.isEmpty()) {
            String part = matches.get(0).trim();
            if (!part.isEmpty()) {
                if (transcript.length() > 0) transcript.append(" ");
                transcript.append(part);
            }
        } else if (currentPartial != null && !currentPartial.trim().isEmpty()) {
            if (transcript.length() > 0) transcript.append(" ");
            transcript.append(currentPartial.trim());
        }
        currentPartial = "";
        updateTranscriptView();
        VoiceOverlayService.setVoiceListening(false);
        if (paused) {
            statusView.setText("থামানো হয়েছে। যাচাই করে ‘পাঠান’ বা ‘আবার চালু’ চাপুন।");
            return;
        }
        statusView.setText("শুনছি… চালিয়ে বলুন, অথবা ‘পাঠান’ চাপুন।");
        handler.postDelayed(this::startSegment, 220);
    }

    private void submitTranscript() {
        if (completed) return;
        String spoken = (transcript.toString() + (currentPartial == null || currentPartial.trim().isEmpty() ? "" : " " + currentPartial.trim())).trim();
        if (spoken.isEmpty()) {
            Toast.makeText(this, "আগে কিছু বলুন, অথবা আবার চেষ্টা করুন।", Toast.LENGTH_SHORT).show();
            return;
        }
        completed = true;
        paused = true;
        try { if (recognizer != null) recognizer.cancel(); } catch (Exception ignored) {}
        VoiceOverlayService.setVoiceListening(false);
        VoiceOverlayService.setVoiceSuccess();
        routeTranscript(spoken);
    }

    private void routeTranscript(String spoken) {
        String normalized = spoken.toLowerCase(Locale.ROOT);
        if (isCallCommand(normalized)) {
            if (handleCallCommand(spoken, normalized)) return;
        }
        String pkg = null;
        if (hasAppWord(normalized, "youtube", "ইউটিউব")) pkg = "com.google.android.youtube";
        else if (hasAppWord(normalized, "facebook", "ফেসবুক")) pkg = "com.facebook.katana";
        else if (hasAppWord(normalized, "instagram", "ইনস্টাগ্রাম")) pkg = "com.instagram.android";
        else if (hasAppWord(normalized, "whatsapp", "হোয়াটসঅ্যাপ", "হোয়াটসঅ্যাপ")) pkg = "com.whatsapp";
        else if (hasAppWord(normalized, "chrome", "ক্রোম", "browser", "ব্রাউজার")) pkg = "com.android.chrome";
        else if (hasAppWord(normalized, "tiktok", "টিকটক", "টিক টক")) pkg = "com.zhiliaoapp.musically";
        else if (hasAppWord(normalized, "maps", "গুগল ম্যাপ", "ম্যাপ")) pkg = "com.google.android.apps.maps";
        else if (hasAppWord(normalized, "gmail", "জিমেইল")) pkg = "com.google.android.gm";
        else if (hasAppWord(normalized, "settings", "সেটিংস")) {
            try { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); } catch (Exception ignored) {}
            finish(); return;
        }
        boolean launchVerb = normalized.matches(".*(খোলো|খুলুন|চালু কর|যাও|open|launch|go to|খুলে দাও|খুলে ফেল).*");
        if (pkg == null && launchVerb) pkg = findInstalledLauncher(normalized);
        if (pkg != null && launchVerb) {
            Intent launch = getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch != null) { launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(launch); finish(); return; }
            Toast.makeText(this, "এই অ্যাপটি ইনস্টল করা নেই; MOSHARROF-এ প্রশ্নটি পাঠাচ্ছি।", Toast.LENGTH_SHORT).show();
        }
        Intent chat = new Intent(this, MainActivity.class);
        chat.putExtra("mosharrof_voice_command", spoken);
        chat.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(chat);
        finish();
    }

    private boolean isCallCommand(String normalized) {
        return normalized.matches(".*(কল দাও|কল করুন|ফোন কর|ফোন দাও|ফোন করুন|call|phone) .*")
            || normalized.endsWith("কল দাও") || normalized.endsWith("ফোন কর")
            || normalized.endsWith("ফোন দাও") || normalized.startsWith("call ");
    }

    private boolean handleCallCommand(String spoken, String normalized) {
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "নাম ধরে কল করতে Contacts অনুমতি দরকার। MOSHARROF AI-এর Settings থেকে Contacts চালু করুন।", Toast.LENGTH_LONG).show();
            return true;
        }
        String target = normalized.replaceAll("কল দাও|কল করুন|ফোন করো?|ফোন দাও|ফোন করুন|আমাকে|দয়া করে|দয়া করে|call|phone|to", " ")
            .replaceAll("\\s+", " ").replaceAll("কে\\s*$", "").trim();
        if (target.isEmpty()) {
            Toast.makeText(this, "কাকে কল করতে চান, নামটি বলুন।", Toast.LENGTH_LONG).show();
            return true;
        }
        String matchedName = null;
        String matchedNumber = null;
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[]{ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER},
                null, null, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC");
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String name = cursor.getString(0);
                    String number = cursor.getString(1);
                    if (name != null && number != null && (name.toLowerCase(Locale.ROOT).contains(target) || target.contains(name.toLowerCase(Locale.ROOT)))) {
                        matchedName = name;
                        matchedNumber = number;
                        break;
                    }
                }
            }
        } catch (SecurityException ignored) {
        } finally {
            if (cursor != null) cursor.close();
        }
        if (matchedNumber == null) {
            Toast.makeText(this, "Contacts-এ ‘" + target + "’ নামটি পাওয়া যায়নি। নামটি যাচাই করে আবার বলুন।", Toast.LENGTH_LONG).show();
            return true;
        }
        final String contactName = matchedName;
        final String phoneNumber = matchedNumber;
        new android.app.AlertDialog.Builder(this)
            .setTitle("কল করার আগে নিশ্চিত করুন")
            .setMessage(contactName + " — " + phoneNumber + "\nএই নম্বরে কল করবেন?")
            .setPositiveButton("কল দিন", (dialog, which) -> {
                try {
                    if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
                        Toast.makeText(this, "Phone অনুমতি নেই। Settings থেকে অনুমতি দিন।", Toast.LENGTH_LONG).show();
                        return;
                    }
                    Intent call = new Intent(Intent.ACTION_CALL, android.net.Uri.parse("tel:" + android.net.Uri.encode(phoneNumber)));
                    startActivity(call);
                } catch (SecurityException | android.content.ActivityNotFoundException error) {
                    Toast.makeText(this, "কল শুরু করা যায়নি। Phone permission যাচাই করুন।", Toast.LENGTH_LONG).show();
                }
            })
            .setNegativeButton("বাতিল", (dialog, which) -> {})
            .show();
        return true;
    }

    private String findInstalledLauncher(String spoken) {
        String target = spoken.toLowerCase(Locale.ROOT)
            .replaceAll("খোলো|খুলুন|চালু করো?|যাও|চলে যাও|open|launch|go to|খুলে দাও|খুলে ফেল", " ")
            .trim();
        if (target.isEmpty()) return null;
        Intent launcher = new Intent(Intent.ACTION_MAIN);
        launcher.addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> apps = getPackageManager().queryIntentActivities(launcher, 0);
        for (ResolveInfo item : apps) {
            if (item.activityInfo == null) continue;
            String label = String.valueOf(item.loadLabel(getPackageManager())).toLowerCase(Locale.ROOT);
            String packageName = item.activityInfo.packageName.toLowerCase(Locale.ROOT);
            if (!label.isEmpty() && (target.contains(label) || label.contains(target))) return item.activityInfo.packageName;
            if (target.length() >= 3 && packageName.contains(target)) return item.activityInfo.packageName;
        }
        return null;
    }

    private boolean hasAppWord(String text, String... words) {
        for (String word : words) if (text.contains(word)) return true;
        return false;
    }

    @Override protected void onDestroy() {
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
        if (!completed) VoiceOverlayService.setVoiceListening(false);
        super.onDestroy();
    }
}
JAVA
