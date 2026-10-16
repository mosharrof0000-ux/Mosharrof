package com.mosharrof.ai;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
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
 * Scoped Android file operations using a folder explicitly selected by the owner.
 * This plugin never scans shared storage without SAF consent and never deletes
 * an item without an explicit confirmation flag from the foreground UI.
 */
@CapacitorPlugin(name = "AndroidFileManager")
public class AndroidFileManagerPlugin extends Plugin {
    private static final String PREFS = "mosharrof_android_file_manager";
    private static final String TREE_URI = "selected_tree_uri";

    @PluginMethod
    public void chooseFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPickerResult");
    }

    @ActivityCallback
    private void folderPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
            || result.getData().getData() == null) {
            call.reject("ফোল্ডার নির্বাচন বাতিল হয়েছে।");
            return;
        }
        Uri uri = result.getData().getData();
        int flags = result.getData().getFlags()
            & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
            getContext().getSharedPreferences(PREFS, 0).edit().putString(TREE_URI, uri.toString()).apply();
            JSObject out = new JSObject();
            out.put("selected", true);
            out.put("uri", uri.toString());
            out.put("scope", "user_selected_folder_only");
            call.resolve(out);
        } catch (SecurityException error) {
            call.reject("নির্বাচিত ফোল্ডারের স্থায়ী অনুমতি সংরক্ষণ করা যায়নি।", error);
        }
    }

    @PluginMethod
    public void getSelectedDirectory(PluginCall call) {
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        JSObject out = new JSObject();
        out.put("selected", true);
        out.put("uri", tree.toString());
        out.put("documentId", DocumentsContract.getTreeDocumentId(tree));
        out.put("scope", "user_selected_folder_only");
        call.resolve(out);
    }

    @PluginMethod
    public void listItems(PluginCall call) {
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        String parentId = call.getString("documentId", DocumentsContract.getTreeDocumentId(tree));
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
        String[] columns = {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_SIZE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED
        };
        JSArray items = new JSArray();
        try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME + " ASC")) {
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    JSObject item = new JSObject();
                    item.put("documentId", cursor.getString(0));
                    item.put("name", cursor.getString(1));
                    item.put("mimeType", cursor.getString(2));
                    item.put("isDirectory", DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2)));
                    item.put("size", cursor.isNull(3) ? 0 : cursor.getLong(3));
                    item.put("lastModified", cursor.isNull(4) ? 0 : cursor.getLong(4));
                    items.put(item);
                }
            }
            JSObject out = new JSObject();
            out.put("items", items);
            out.put("count", items.length());
            out.put("scope", "user_selected_folder_only");
            call.resolve(out);
        } catch (Exception error) {
            call.reject("নির্বাচিত ফোল্ডারের তালিকা পড়া যায়নি।", error);
        }
    }

    @PluginMethod
    public void createFolder(PluginCall call) {
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        String name = safeName(call.getString("name"));
        if (name == null) { call.reject("ফোল্ডারের নাম সঠিক নয়।"); return; }
        String parentId = call.getString("documentId", DocumentsContract.getTreeDocumentId(tree));
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, parentId);
        try {
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), parent,
                DocumentsContract.Document.MIME_TYPE_DIR, name);
            if (created == null) { call.reject("ফোল্ডার তৈরি হয়নি।"); return; }
            JSObject out = new JSObject();
            out.put("created", true);
            out.put("uri", created.toString());
            out.put("documentId", DocumentsContract.getDocumentId(created));
            out.put("name", name);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("ফোল্ডার তৈরি করা যায়নি।", error);
        }
    }

    @PluginMethod
    public void createTextFile(PluginCall call) {
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        String name = safeName(call.getString("name"));
        if (name == null || name.lastIndexOf('.') <= 0) {
            call.reject("ফাইলের নাম ও extension দিন, যেমন notes.txt।");
            return;
        }
        String parentId = call.getString("documentId", DocumentsContract.getTreeDocumentId(tree));
        Uri parent = DocumentsContract.buildDocumentUriUsingTree(tree, parentId);
        try {
            Uri created = DocumentsContract.createDocument(getContext().getContentResolver(), parent, "text/plain", name);
            if (created == null) { call.reject("ফাইল তৈরি হয়নি।"); return; }
            String body = call.getString("content", "");
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(created, "w")) {
                if (stream == null) throw new IllegalStateException("No output stream");
                stream.write(body.getBytes(StandardCharsets.UTF_8));
            }
            JSObject out = new JSObject();
            out.put("created", true);
            out.put("uri", created.toString());
            out.put("name", name);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("টেক্সট ফাইল তৈরি করা যায়নি।", error);
        }
    }

    @PluginMethod
    public void renameItem(PluginCall call) {
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        String documentId = call.getString("documentId");
        String name = safeName(call.getString("name"));
        if (documentId == null || documentId.trim().isEmpty() || name == null) {
            call.reject("ফাইলের পরিচয় বা নতুন নাম সঠিক নয়।");
            return;
        }
        Uri document = DocumentsContract.buildDocumentUriUsingTree(tree, documentId);
        try {
            Uri renamed = DocumentsContract.renameDocument(getContext().getContentResolver(), document, name);
            if (renamed == null) { call.reject("নাম পরিবর্তন করা যায়নি।"); return; }
            JSObject out = new JSObject();
            out.put("renamed", true);
            out.put("uri", renamed.toString());
            out.put("name", name);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("নাম পরিবর্তন করা যায়নি।", error);
        }
    }

    @PluginMethod
    public void deleteItem(PluginCall call) {
        if (!call.getBoolean("confirmed", false)) {
            call.reject("মুছে ফেলার আগে স্পষ্ট নিশ্চিতকরণ আবশ্যক।");
            return;
        }
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        String documentId = call.getString("documentId");
        if (documentId == null || documentId.trim().isEmpty()) {
            call.reject("মুছতে চাওয়া ফাইলের পরিচয় নেই।");
            return;
        }
        Uri document = DocumentsContract.buildDocumentUriUsingTree(tree, documentId);
        try {
            boolean deleted = DocumentsContract.deleteDocument(getContext().getContentResolver(), document);
            JSObject out = new JSObject();
            out.put("deleted", deleted);
            out.put("recoverable", false);
            if (deleted) call.resolve(out); else call.reject("Android ফাইলটি মুছতে পারেনি।");
        } catch (Exception error) {
            call.reject("ফাইল মুছে ফেলা যায়নি।", error);
        }
    }


    @PluginMethod
    public void scanDuplicates(PluginCall call) {
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        AndroidDuplicateScanner.scan(getContext().getContentResolver(), tree, call);
    }

    private Uri getTreeUri(PluginCall call) {
        String value = getContext().getSharedPreferences(PREFS, 0).getString(TREE_URI, null);
        if (value == null) {
            call.reject("আগে নিজের অনুমোদিত ফোল্ডার নির্বাচন করুন।");
            return null;
        }
        try {
            return Uri.parse(value);
        } catch (Exception error) {
            call.reject("সংরক্ষিত ফোল্ডার URI পড়া যায়নি।", error);
            return null;
        }
    }

    private String safeName(String value) {
        if (value == null) return null;
        String name = value.trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")
            || name.contains("/") || name.contains("\\") || name.indexOf('\u0000') >= 0) return null;
        return name.length() > 180 ? name.substring(0, 180) : name;
    }
}
