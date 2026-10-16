package com.mosharrof.ai;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import com.getcapacitor.ActivityCallback;
import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/**
 * User-authorized file operations through Android Storage Access Framework.
 * Access is limited to the folder the owner explicitly selects. Deletion is never implicit.
 */
@CapacitorPlugin(name = "FileManager")
public class FileManagerPlugin extends Plugin {
    private static final String PREFS = "mosharrof_file_manager";
    private static final String TREE = "tree_uri";
    private static final int MAX_SCAN_FILES = 3000;
    private static final long MAX_HASH_BYTES = 64L * 1024L * 1024L;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("ফোল্ডার নির্বাচন করা হয়নি।");
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) { call.reject("নির্বাচিত ফোল্ডারের ঠিকানা পাওয়া যায়নি।"); return; }
        int flags = result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
            getContext().getSharedPreferences(PREFS, 0).edit().putString(TREE, uri.toString()).apply();
            JSObject out = new JSObject();
            out.put("selected", true);
            out.put("treeUri", uri.toString());
            call.resolve(out);
        } catch (Exception e) {
            call.reject("ফোল্ডারের অনুমতি সংরক্ষণ করা যায়নি: " + safeMessage(e));
        }
    }

    @PluginMethod
    public void getSelectedFolder(PluginCall call) {
        String value = tree();
        JSObject out = new JSObject();
        out.put("selected", value != null);
        if (value != null) out.put("treeUri", value);
        call.resolve(out);
    }

    @PluginMethod
    public void listEntries(PluginCall call) {
        Uri tree = requireTree(call);
        if (tree == null) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
        JSONArray entries = new JSONArray();
        try (Cursor cursor = getContext().getContentResolver().query(children,
                new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE,
                        DocumentsContract.Document.COLUMN_LAST_MODIFIED}, null, null,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME + " COLLATE NOCASE ASC")) {
            if (cursor != null) while (cursor.moveToNext()) {
                JSObject item = new JSObject();
                item.put("id", cursor.getString(0));
                item.put("name", cursor.getString(1));
                item.put("directory", DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2)));
                item.put("mimeType", cursor.getString(2));
                item.put("size", cursor.isNull(3) ? 0 : cursor.getLong(3));
                item.put("modified", cursor.isNull(4) ? 0 : cursor.getLong(4));
                entries.put(item);
            }
            JSObject out = new JSObject();
            out.put("entries", entries);
            out.put("count", entries.length());
            call.resolve(out);
        } catch (Exception e) { call.reject("ফাইলের তালিকা পড়া যায়নি: " + safeMessage(e)); }
    }

    @PluginMethod
    public void createFolder(PluginCall call) {
        String name = safeName(call.getString("name"), call);
        if (name == null) return;
        Uri tree = requireTree(call); if (tree == null) return;
        try {
            Uri parent = rootDocumentUri(tree);
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), parent,
                    DocumentsContract.Document.MIME_TYPE_DIR, name);
            if (created == null) throw new IllegalStateException("Android returned no folder URI");
            JSObject out = new JSObject(); out.put("created", true); out.put("name", name); call.resolve(out);
        } catch (Exception e) { call.reject("ফোল্ডার তৈরি হয়নি: " + safeMessage(e)); }
    }

    @PluginMethod
    public void createTextFile(PluginCall call) {
        String name = safeName(call.getString("name"), call);
        if (name == null) return;
        String content = call.getString("content", "");
        if (content == null || content.length() > 1_000_000) { call.reject("ফাইলের লেখা ১,০০০,০০০ অক্ষরের মধ্যে হতে হবে।"); return; }
        Uri tree = requireTree(call); if (tree == null) return;
        try {
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(),
                    rootDocumentUri(tree), mimeFor(name), name);
            if (created == null) throw new IllegalStateException("Android returned no file URI");
            try (java.io.OutputStream stream = getContext().getContentResolver().openOutputStream(created, "w")) {
                if (stream == null) throw new IllegalStateException("ফাইল লেখার স্ট্রিম খোলা যায়নি");
                stream.write(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            JSObject out = new JSObject(); out.put("created", true); out.put("name", name); call.resolve(out);
        } catch (Exception e) { call.reject("ফাইল তৈরি হয়নি: " + safeMessage(e)); }
    }

    @PluginMethod
    public void renameEntry(PluginCall call) {
        String id = call.getString("id");
        String name = safeName(call.getString("name"), call);
        if (id == null || id.trim().isEmpty() || name == null) { if (id == null) call.reject("ফাইল আইডি দরকার।"); return; }
        Uri tree = requireTree(call); if (tree == null) return;
        try {
            Uri target = DocumentsContract.buildDocumentUriUsingTree(tree, id);
            Uri renamed = DocumentsContract.renameDocument(getContext().getContentResolver(), target, name);
            if (renamed == null) throw new IllegalStateException("Android could not rename this entry");
            JSObject out = new JSObject(); out.put("renamed", true); out.put("name", name); call.resolve(out);
        } catch (Exception e) { call.reject("নাম পরিবর্তন হয়নি: " + safeMessage(e)); }
    }

    @PluginMethod
    public void deleteEntry(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.trim().isEmpty()) { call.reject("ফাইল আইডি দরকার।"); return; }
        Uri tree = requireTree(call); if (tree == null) return;
        try {
            Uri target = DocumentsContract.buildDocumentUriUsingTree(tree, id);
            boolean deleted = DocumentsContract.deleteDocument(getContext().getContentResolver(), target);
            if (!deleted) throw new IllegalStateException("Android declined deletion");
            JSObject out = new JSObject(); out.put("deleted", true); call.resolve(out);
        } catch (Exception e) { call.reject("মুছে ফেলা যায়নি: " + safeMessage(e)); }
    }

    @PluginMethod
    public void scanDuplicates(PluginCall call) {
        Uri tree = requireTree(call); if (tree == null) return;
        ArrayDeque<Uri> pending = new ArrayDeque<>();
        Map<String, JSONArray> byHash = new HashMap<>();
        int scanned = 0; long bytes = 0;
        try {
            pending.add(rootDocumentUri(tree));
            ContentResolver resolver = getContext().getContentResolver();
            while (!pending.isEmpty() && scanned < MAX_SCAN_FILES && bytes < MAX_HASH_BYTES) {
                Uri parent = pending.removeFirst();
                String parentId = DocumentsContract.getDocumentId(parent);
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
                try (Cursor cursor = resolver.query(children,
                        new String[]{DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                                DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE},
                        null, null, null)) {
                    if (cursor == null) continue;
                    while (cursor.moveToNext() && scanned < MAX_SCAN_FILES && bytes < MAX_HASH_BYTES) {
                        String id = cursor.getString(0), name = cursor.getString(1), mime = cursor.getString(2);
                        Uri itemUri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) { pending.add(itemUri); continue; }
                        scanned++;
                        long size = cursor.isNull(3) ? 0 : cursor.getLong(3);
                        if (size <= 0 || size > MAX_HASH_BYTES - bytes) continue;
                        String hash = sha256(resolver, itemUri, size);
                        if (hash == null) continue;
                        bytes += size;
                        JSONArray group = byHash.get(hash);
                        if (group == null) { group = new JSONArray(); byHash.put(hash, group); }
                        JSObject item = new JSObject(); item.put("id", id); item.put("name", name); item.put("size", size);
                        group.put(item);
                    }
                }
            }
            JSONArray duplicates = new JSONArray();
            for (Map.Entry<String, JSONArray> entry : byHash.entrySet()) {
                if (entry.getValue().length() > 1) {
                    JSObject group = new JSObject(); group.put("sha256", entry.getKey()); group.put("files", entry.getValue());
                    duplicates.put(group);
                }
            }
            JSObject out = new JSObject(); out.put("groups", duplicates); out.put("filesScanned", scanned);
            out.put("bytesHashed", bytes); out.put("truncated", !pending.isEmpty() || scanned >= MAX_SCAN_FILES || bytes >= MAX_HASH_BYTES);
            call.resolve(out);
        } catch (Exception e) { call.reject("ডুপ্লিকেট স্ক্যান সম্পন্ন হয়নি: " + safeMessage(e)); }
    }

    private String sha256(ContentResolver resolver, Uri uri, long expectedSize) {
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) return null;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192]; long readTotal = 0; int read;
            while ((read = in.read(buffer)) != -1) {
                readTotal += readTotal == 0 ? 0 : 0;
                if (readTotal + read > expectedSize || readTotal + read > MAX_HASH_BYTES) return null;
                digest.update(buffer, 0, read); readTotal += read;
            }
            StringBuilder out = new StringBuilder();
            for (byte b : digest.digest()) out.append(String.format(java.util.Locale.ROOT, "%02x", b));
            return out.toString();
        } catch (Exception ignored) { return null; }
    }

    private Uri requireTree(PluginCall call) {
        String value = tree();
        if (value == null) { call.reject("আগে 'ফোল্ডার নির্বাচন' করে একটি ফোল্ডারে অনুমতি দিন।"); return null; }
        return Uri.parse(value);
    }
    private String tree() { return getContext().getSharedPreferences(PREFS, 0).getString(TREE, null); }
    private Uri rootDocumentUri(Uri tree) {
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }
    private String safeName(String value, PluginCall call) {
        if (value == null) { call.reject("নাম দিতে হবে।"); return null; }
        String name = value.trim();
        if (name.isEmpty() || name.length() > 180 || name.equals(".") || name.equals("..")
                || name.contains("/") || name.contains("\\") || name.indexOf('\u0000') >= 0) {
            call.reject("নামটি বৈধ নয়। ১–১৮০ অক্ষরের নাম দিন; / ও \\ ব্যবহার করবেন না."); return null;
        }
        return name;
    }
    private String mimeFor(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(java.util.Locale.ROOT) : "";
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime == null ? "text/plain" : mime;
    }
    private String safeMessage(Exception e) {
        String m = e.getMessage();
        return m == null || m.trim().isEmpty() ? e.getClass().getSimpleName() : m.substring(0, Math.min(180, m.length()));
    }
}
