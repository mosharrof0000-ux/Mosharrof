package com.mosharrof.ai;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.util.Base64;

/** Saves generated speech audio to the user's public Downloads folder. */
@CapacitorPlugin(name = "MessageAudioDownload")
public class MessageAudioDownloadPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String encoded = call.getString("base64");
        String requestedName = call.getString("filename", "mosharrof-message-audio.mp3");
        String mime = call.getString("mimeType", "audio/mpeg");
        if (encoded == null || encoded.isEmpty()) {
            call.reject("অডিও ডেটা পাওয়া যায়নি।");
            return;
        }
        String filename = requestedName.replaceAll("[^A-Za-z0-9._-]", "_");
        if (filename.isEmpty()) filename = "mosharrof-message-audio.mp3";
        byte[] bytes;
        try {
            bytes = Base64.decode(encoded, Base64.DEFAULT);
        } catch (IllegalArgumentException error) {
            call.reject("অডিও ডেটা পড়া যায়নি।");
            return;
        }
        if (bytes.length == 0) {
            call.reject("অডিও ফাইল খালি।");
            return;
        }
        OutputStream stream = null;
        Uri savedUri = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/MOSHARROF");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                savedUri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (savedUri == null) throw new IllegalStateException("Downloads storage unavailable");
                stream = getContext().getContentResolver().openOutputStream(savedUri);
                if (stream == null) throw new IllegalStateException("Could not open Downloads file");
                stream.write(bytes);
                stream.flush();
                stream.close();
                stream = null;
                ContentValues ready = new ContentValues();
                ready.put(MediaStore.MediaColumns.IS_PENDING, 0);
                getContext().getContentResolver().update(savedUri, ready, null, null);
            } else {
                File folder = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("Downloads folder unavailable");
                File target = new File(folder, filename);
                stream = new FileOutputStream(target);
                stream.write(bytes);
                stream.flush();
                stream.close();
                stream = null;
                savedUri = Uri.fromFile(target);
            }
            JSObject result = new JSObject();
            result.put("saved", true);
            result.put("uri", savedUri.toString());
            result.put("filename", filename);
            result.put("bytes", bytes.length);
            result.put("location", "Downloads/MOSHARROF");
            call.resolve(result);
        } catch (Exception error) {
            if (stream != null) try { stream.close(); } catch (Exception ignored) {}
            if (savedUri != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try { getContext().getContentResolver().delete(savedUri, null, null); } catch (Exception ignored) {}
            }
            call.reject("অডিও Downloads ফোল্ডারে সংরক্ষণ করা যায়নি: " + error.getMessage());
        }
    }
}
