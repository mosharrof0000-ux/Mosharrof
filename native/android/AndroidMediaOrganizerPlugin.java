package com.mosharrof.ai;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Confirmed file moves restricted to the SAF tree explicitly selected by the owner. */
@CapacitorPlugin(name = "AndroidMediaOrganizer")
public class AndroidMediaOrganizerPlugin extends Plugin {
    private static final String PREFS = "mosharrof_android_file_manager";
    private static final String TREE_URI = "selected_tree_uri";

    @PluginMethod
    public void moveItem(PluginCall call) {
        if (!call.getBoolean("confirmed", false)) {
            call.reject("ফাইল সরানোর আগে স্পষ্ট নিশ্চিতকরণ আবশ্যক।");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            call.reject("এই Android সংস্করণে SAF moveDocument সমর্থিত নয়।");
            return;
        }
        Uri tree = getTreeUri(call);
        if (tree == null) return;
        String documentId = call.getString("documentId");
        String targetId = call.getString("targetDirectoryId");
        String rootId = DocumentsContract.getTreeDocumentId(tree);
        String sourceParentId = call.getString("sourceParentId", rootId);
        if (blank(documentId) || blank(targetId) || blank(sourceParentId)
                || documentId.equals(rootId) || documentId.equals(targetId)
                || sourceParentId.equals(targetId)) {
            call.reject("ফাইল বা গন্তব্য ফোল্ডারের পরিচয় সঠিক নয়।");
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        Uri source = DocumentsContract.buildDocumentUriUsingTree(tree, documentId);
        Uri sourceParent = DocumentsContract.buildDocumentUriUsingTree(tree, sourceParentId);
        Uri target = DocumentsContract.buildDocumentUriUsingTree(tree, targetId);
        try {
            if (!isDirectory(resolver, target) || !isDirectory(resolver, sourceParent)) {
                call.reject("উৎস ও গন্তব্য অবশ্যই নির্বাচিত ফোল্ডারের বৈধ directory হতে হবে।");
                return;
            }
            Uri moved = DocumentsContract.moveDocument(resolver, source, sourceParent, target);
            if (moved == null) {
                call.reject("Android-এর ফাইল provider ফাইলটি সরাতে পারেনি।");
                return;
            }
            JSObject out = new JSObject();
            out.put("moved", true);
            out.put("uri", moved.toString());
            out.put("documentId", DocumentsContract.getDocumentId(moved));
            out.put("sourceParentId", sourceParentId);
            out.put("targetDirectoryId", targetId);
            out.put("reversible", true);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("ফাইল সরানো যায়নি; provider অনুমতি বা format সমর্থন যাচাই করুন।", error);
        }
    }

    private boolean isDirectory(ContentResolver resolver, Uri document) {
        String[] columns = { DocumentsContract.Document.COLUMN_MIME_TYPE };
        try (Cursor cursor = resolver.query(document, columns, null, null, null)) {
            return cursor != null && cursor.moveToFirst()
                && DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(0));
        } catch (Exception ignored) {
            return false;
        }
    }

    private Uri getTreeUri(PluginCall call) {
        String value = getContext().getSharedPreferences(PREFS, 0).getString(TREE_URI, null);
        if (blank(value)) {
            call.reject("আগে নিজের অনুমোদিত ফোল্ডার নির্বাচন করুন।");
            return null;
        }
        return Uri.parse(value);
    }

    private boolean blank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
