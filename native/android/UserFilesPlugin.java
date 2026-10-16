package com.mosharrof.ai;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * User-authorized Storage Access Framework operations.
 * Only operates on a tree URI explicitly selected by the device owner.
 * Destructive operations require a fresh explicit confirmation flag from UI.
 */
@CapacitorPlugin(name = "UserFiles")
public class UserFilesPlugin extends Plugin {
    private static final int PICK_TREE_REQUEST = 7411;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "handleFolderPicked");
    }

    @SuppressWarnings("unused")
    private void handleFolderPicked(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null
            || result.getData().getData() == null) {
            call.reject("ফোল্ডার নির্বাচন বাতিল হয়েছে।");
            return;
        }
        Uri uri = result.getData().getData();
        int flags = result.getData().getFlags()
            & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (SecurityException ex) {
            call.reject("এই ফোল্ডারের স্থায়ী অনুমতি নেওয়া যায়নি। আবার ফোল্ডার নির্বাচন করুন।");
            return;
        }
        JSObject out = new JSObject();
        out.put("treeUri", uri.toString());
        out.put("permissionFlags", flags);
        out.put("ownerSelected", true);
        call.resolve(out);
    }

    @PluginMethod
    public void listEntries(PluginCall call) {
        Uri tree = parseTree(call);
        if (tree == null) return;
        try {
            Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(
                tree, DocumentsContract.getTreeDocumentId(tree));
            JSArray entries = new JSArray();
            String[] projection = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED
            };
            try (Cursor cursor = getContext().getContentResolver().query(children, projection, null, null,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME + " ASC")) {
                if (cursor != null) {
                    while (cursor.moveToNext()) {
                        JSObject item = new JSObject();
                        String id = cursor.getString(0);
                        item.put("documentId", id);
                        item.put("name", cursor.getString(1));
                        String mime = cursor.getString(2);
                        item.put("mimeType", mime);
                        item.put("isDirectory", DocumentsContract.Document.MIME_TYPE_DIR.equals(mime));
                        item.put("size", cursor.isNull(3) ? 0 : cursor.getLong(3));
                        item.put("lastModified", cursor.isNull(4) ? 0 : cursor.getLong(4));
                        item.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString());
                        entries.put(item);
                    }
                }
            }
            JSObject out = new JSObject();
            out.put("entries", entries);
            out.put("treeUri", tree.toString());
            call.resolve(out);
        } catch (Exception ex) {
            call.reject("ফোল্ডারের তালিকা পড়া যায়নি। অনুমতি বা ফোল্ডারটি পরীক্ষা করুন।", ex);
        }
    }

    @PluginMethod
    public void createFolder(PluginCall call) {
        Uri tree = parseTree(call);
        if (tree == null) return;
        String name = safeName(call.getString("name"));
        if (name == null) { call.reject("ফোল্ডারের নাম সঠিক নয়।"); return; }
        try {
            Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), parent,
                DocumentsContract.Document.MIME_TYPE_DIR, name);
            if (created == null) { call.reject("ফোল্ডার তৈরি হয়নি; একই নাম আগে থেকেই থাকতে পারে।"); return; }
            JSObject out = new JSObject(); out.put("uri", created.toString()); out.put("name", name);
            out.put("created", true); call.resolve(out);
        } catch (Exception ex) { call.reject("ফোল্ডার তৈরি করা যায়নি।", ex); }
    }

    @PluginMethod
    public void createTextFile(PluginCall call) {
        Uri tree = parseTree(call);
        if (tree == null) return;
        String name = safeName(call.getString("name"));
        if (name == null) { call.reject("ফাইলের নাম সঠিক নয়।"); return; }
        String content = call.getString("content", "");
        if (content == null) content = "";
        if (content.length() > 1_000_000) { call.reject("ফাইলের বিষয়বস্তু ১ MB সীমা ছাড়িয়েছে।"); return; }
        try {
            Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), parent, "text/plain", name);
            if (created == null) { call.reject("ফাইল তৈরি হয়নি; একই নাম আগে থেকেই থাকতে পারে।"); return; }
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(created, "w")) {
                if (stream == null) throw new IllegalStateException("No output stream");
                stream.write(content.getBytes(StandardCharsets.UTF_8));
            }
            JSObject out = new JSObject(); out.put("uri", created.toString()); out.put("name", name);
            out.put("created", true); call.resolve(out);
        } catch (Exception ex) { call.reject("ফাইল তৈরি করা যায়নি।", ex); }
    }

    @PluginMethod
    public void renameEntry(PluginCall call) {
        Uri tree = parseTree(call);
        if (tree == null) return;
        Uri target = parseTarget(call, tree);
        if (target == null) return;
        String name = safeName(call.getString("newName"));
        if (name == null) { call.reject("নতুন নাম সঠিক নয়।"); return; }
        try {
            Uri renamed = DocumentsContract.renameDocument(getContext().getContentResolver(), target, name);
            if (renamed == null) { call.reject("নাম পরিবর্তন করা যায়নি।"); return; }
            JSObject out = new JSObject(); out.put("uri", renamed.toString()); out.put("name", name);
            out.put("renamed", true); call.resolve(out);
        } catch (Exception ex) { call.reject("নাম পরিবর্তন করা যায়নি।", ex); }
    }

    @PluginMethod
    public void deleteEntry(PluginCall call) {
        Uri tree = parseTree(call);
        if (tree == null) return;
        if (!Boolean.TRUE.equals(call.getBoolean("confirmed", false))) {
            call.reject("মুছে ফেলার আগে স্পষ্ট নিশ্চিতকরণ আবশ্যক।");
            return;
        }
        Uri target = parseTarget(call, tree);
        if (target == null) return;
        try {
            boolean deleted = DocumentsContract.deleteDocument(getContext().getContentResolver(), target);
            JSObject out = new JSObject(); out.put("deleted", deleted);
            if (!deleted) { call.reject("Android ফাইল প্রদানকারী মুছে ফেলতে পারেনি।"); return; }
            call.resolve(out);
        } catch (Exception ex) { call.reject("ফাইল মুছে ফেলা যায়নি।", ex); }
    }

    private Uri parseTree(PluginCall call) {
        String raw = call.getString("treeUri");
        if (raw == null || raw.trim().isEmpty()) { call.reject("আগে একটি ফোল্ডার নির্বাচন করুন।"); return null; }
        try {
            Uri tree = Uri.parse(raw);
            boolean granted = false;
            for (android.content.UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
                if (permission.getUri().equals(tree) && permission.isReadPermission() && permission.isWritePermission()) {
                    granted = true; break;
                }
            }
            if (!granted) { call.reject("ফোল্ডারের অনুমতি আর সক্রিয় নেই; আবার নির্বাচন করুন।"); return null; }
            return tree;
        } catch (Exception ex) { call.reject("ফোল্ডারের URI সঠিক নয়。", ex); return null; }
    }

    private Uri parseTarget(PluginCall call, Uri tree) {
        String raw = call.getString("uri");
        if (raw == null || raw.trim().isEmpty()) { call.reject("লক্ষ্য ফাইলের URI নেই।"); return null; }
        try {
            Uri target = Uri.parse(raw);
            String treeId = DocumentsContract.getTreeDocumentId(tree);
            String targetId = DocumentsContract.getDocumentId(target);
            if (targetId == null || !(targetId.equals(treeId) || targetId.startsWith(treeId + "/"))) {
                call.reject("নির্বাচিত ফোল্ডারের বাইরের ফাইল ব্যবহার করা যাবে না।"); return null;
            }
            return DocumentsContract.buildDocumentUriUsingTree(tree, targetId);
        } catch (Exception ex) { call.reject("লক্ষ্য ফাইলের URI সঠিক নয়।", ex); return null; }
    }

    private String safeName(String name) {
        if (name == null) return null;
        String value = name.trim();
        if (value.isEmpty() || value.length() > 180 || value.equals(".") || value.equals("..")
            || value.contains("/") || value.contains("\\\\") || value.indexOf('\0') >= 0) return null;
        return value;
    }
}
