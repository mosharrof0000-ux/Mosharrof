package com.mosharrof.ai;

import android.app.Activity;
import android.content.Intent;
import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import com.getcapacitor.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * SAF-only file manager. It can access only a directory explicitly selected by
 * the device owner through Android's system document picker.
 */
@CapacitorPlugin(name = "AndroidFileManager")
public class MosharrofFilesPlugin extends Plugin {
    private static final String PREFS = "mosharrof_saf";
    private static final String ROOT = "selected_tree_uri";

    @PluginMethod
    public void chooseFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "directoryPicked");
    }

    @ActivityCallback
    private void directoryPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
                || result.getData().getData() == null) {
            call.reject("কোনো ফোল্ডার নির্বাচন করা হয়নি।");
            return;
        }
        Uri tree = result.getData().getData();
        int flags = result.getData().getFlags()
                & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(tree, flags);
            getContext().getSharedPreferences(PREFS, 0).edit().putString(ROOT, tree.toString()).apply();
            JSObject out = new JSObject();
            out.put("selected", true);
            out.put("treeUri", tree.toString());
            out.put("uri", tree.toString());
            out.put("name", queryDisplayName(tree));
            call.resolve(out);
        } catch (SecurityException error) {
            call.reject("Android ফোল্ডার অ্যাক্সেসের অনুমতি সংরক্ষণ করতে পারেনি। আবার ফোল্ডার নির্বাচন করুন।", error);
        }
    }

    @PluginMethod
    public void getSelectedDirectory(PluginCall call) {
        Uri root = selectedRoot();
        JSObject out = new JSObject();
        out.put("selected", root != null);
        if (root != null) {
            out.put("treeUri", root.toString());
            out.put("uri", root.toString());
            out.put("name", queryDisplayName(root));
        }
        call.resolve(out);
    }

    @PluginMethod
    public void listItems(PluginCall call) {
        Uri root = requireRoot(call);
        if (root == null) return;
        String parentId = call.getString("documentId", DocumentsContract.getTreeDocumentId(root));
        if (!validDocumentId(root, parentId)) {
            call.reject("ফোল্ডারের পরিচয় বৈধ নয়।");
            return;
        }
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(root, parentId);
        String[] columns = { DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED };
        JSArray entries = new JSArray();
        try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME + " ASC")) {
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject item = new JSObject();
                    item.put("id", cursor.getString(0));
                    item.put("name", cursor.getString(1));
                    String mime = cursor.getString(2);
                    item.put("directory", DocumentsContract.Document.MIME_TYPE_DIR.equals(mime));
                    item.put("mimeType", mime == null ? "" : mime);
                    item.put("size", cursor.isNull(3) ? 0 : cursor.getLong(3));
                    item.put("lastModified", cursor.isNull(4) ? 0 : cursor.getLong(4));
                    entries.put(item);
                }
            }
            JSObject out = new JSObject();
            out.put("entries", entries);
            out.put("items", entries);
            out.put("count", entries.length());
            call.resolve(out);
        } catch (Exception error) {
            call.reject("নির্বাচিত ফোল্ডারের তালিকা পড়া যায়নি। অনুমতি আবার দিন কি না যাচাই করুন।", error);
        }
    }

    @PluginMethod
    public void createFolder(PluginCall call) {
        Uri root = requireRoot(call);
        if (root == null) return;
        String name = safeName(call.getString("name"));
        if (name == null) { call.reject("ফোল্ডারের বৈধ নাম দিন।"); return; }
        createEntry(call, root, name, DocumentsContract.Document.MIME_TYPE_DIR, null);
    }

    @PluginMethod
    public void createTextFile(PluginCall call) {
        Uri root = requireRoot(call);
        if (root == null) return;
        String name = safeName(call.getString("name"));
        String content = call.getString("content", "");
        if (name == null || name.lastIndexOf('.') <= 0) {
            call.reject("ফাইলের নাম এক্সটেনশনসহ দিন, যেমন notes.txt।");
            return;
        }
        Uri created = createEntryUri(root, name, "text/plain", call);
        if (created == null) return;
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(created, "w")) {
            if (stream == null) throw new IllegalStateException("File output stream unavailable");
            stream.write(content.getBytes(StandardCharsets.UTF_8));
            JSObject out = new JSObject();
            out.put("created", true);
            out.put("id", DocumentsContract.getDocumentId(created));
            out.put("name", name);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("ফাইল তৈরি হয়েছে, কিন্তু লেখা সম্পূর্ণ হয়নি। ফাইলটি যাচাই করুন।", error);
        }
    }

    @PluginMethod
    public void renameItem(PluginCall call) {
        Uri root = requireRoot(call);
        if (root == null) return;
        String id = call.getString("documentId", call.getString("id"));
        String name = safeName(call.getString("name"));
        if (!validDocumentId(root, id) || name == null) {
            call.reject("ফাইল বা ফোল্ডারের পরিচয়/নাম বৈধ নয়।");
            return;
        }
        try {
            Uri target = DocumentsContract.buildDocumentUriUsingTree(root, id);
            Uri renamed = DocumentsContract.renameDocument(getContext().getContentResolver(), target, name);
            if (renamed == null) throw new IllegalStateException("Provider did not rename document");
            JSObject out = new JSObject();
            out.put("renamed", true);
            out.put("id", DocumentsContract.getDocumentId(renamed));
            out.put("name", name);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("ফাইল/ফোল্ডারের নাম বদলানো যায়নি।", error);
        }
    }

    @PluginMethod
    public void deleteItem(PluginCall call) {
        Uri root = requireRoot(call);
        if (root == null) return;
        String id = call.getString("id");
        Boolean confirmed = call.getBoolean("confirmed", false);
        if (!Boolean.TRUE.equals(confirmed)) {
            call.reject("মুছতে হলে আগে অ্যাপে স্পষ্টভাবে নিশ্চিত করতে হবে।");
            return;
        }
        if (!validDocumentId(root, id)) {
            call.reject("ফাইল বা ফোল্ডারের পরিচয় বৈধ নয়।");
            return;
        }
        try {
            Uri target = DocumentsContract.buildDocumentUriUsingTree(root, id);
            boolean deleted = DocumentsContract.deleteDocument(getContext().getContentResolver(), target);
            JSObject out = new JSObject();
            out.put("deleted", deleted);
            out.put("recoverable", false);
            out.put("warning", "এই ফাইল-প্রোভাইডারে Trash/Undo নিশ্চিত নয়; মুছে ফেলার আগে ব্যাকআপ যাচাই করুন।");
            call.resolve(out);
        } catch (Exception error) {
            call.reject("ফাইল মুছতে পারেনি; সম্ভবত ফোল্ডার বা ফাইলটি সুরক্ষিত।", error);
        }
    }

    private Uri createEntryUri(Uri root, String name, String mime, PluginCall call) {
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(root, DocumentsContract.getTreeDocumentId(root));
        try {
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), parent, mime, name);
            if (created == null) throw new IllegalStateException("Provider returned no document URI");
            return created;
        } catch (Exception error) {
            call.reject("নতুন ফাইল/ফোল্ডার তৈরি করা যায়নি; নামটি আগে থেকেই আছে কি না দেখুন।", error);
            return null;
        }
    }

    private void createEntry(PluginCall call, Uri root, String name, String mime, String ignored) {
        Uri created = createEntryUri(root, name, mime, call);
        if (created == null) return;
        JSObject out = new JSObject();
        out.put("created", true);
        out.put("id", DocumentsContract.getDocumentId(created));
        out.put("name", name);
        out.put("directory", DocumentsContract.Document.MIME_TYPE_DIR.equals(mime));
        call.resolve(out);
    }

    private Uri requireRoot(PluginCall call) {
        Uri root = selectedRoot();
        if (root == null) call.reject("আগে Android-এর ফোল্ডার বাছাই করুন।");
        return root;
    }

    private Uri selectedRoot() {
        String value = getContext().getSharedPreferences(PREFS, 0).getString(ROOT, null);
        if (value == null) return null;
        try { return Uri.parse(value); } catch (Exception ignored) { return null; }
    }

    private boolean validDocumentId(Uri root, String id) {
        if (id == null || id.trim().isEmpty()) return false;
        try {
            Uri uri = DocumentsContract.buildDocumentUriUsingTree(root, id);
            return root.getAuthority() != null && root.getAuthority().equals(uri.getAuthority());
        } catch (Exception error) { return false; }
    }

    private String safeName(String raw) {
        if (raw == null) return null;
        String name = raw.trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")
                || name.contains("/") || name.contains("\\") || name.indexOf('\0') >= 0) return null;
        return name;
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri,
                new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) { }
        return "নির্বাচিত ফোল্ডার";
    }
}
