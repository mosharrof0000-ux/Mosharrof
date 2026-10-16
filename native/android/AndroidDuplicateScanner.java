package com.mosharrof.ai;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;

/** Bounded, read-only SHA-256 duplicate scanner for an owner-selected SAF tree. */
final class AndroidDuplicateScanner {
    private static final int MAX_FILES = 3000;
    private static final int MAX_ENTRIES = 6000;
    private static final long MAX_BYTES = 64L * 1024L * 1024L;

    private AndroidDuplicateScanner() { }

    static void scan(ContentResolver resolver, Uri tree, PluginCall call) {
        ArrayDeque<String> pending = new ArrayDeque<>();
        Map<String, JSArray> byHash = new HashMap<>();
        int scanned = 0;
        int visitedEntries = 0;
        long hashedBytes = 0;
        pending.add(DocumentsContract.getTreeDocumentId(tree));
        try {
            while (!pending.isEmpty() && scanned < MAX_FILES
                    && visitedEntries < MAX_ENTRIES && hashedBytes < MAX_BYTES) {
                String parentId = pending.removeFirst();
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId);
                String[] columns = {
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE,
                    DocumentsContract.Document.COLUMN_SIZE
                };
                try (Cursor cursor = resolver.query(children, columns, null, null, null)) {
                    if (cursor == null) continue;
                    while (cursor.moveToNext() && scanned < MAX_FILES
                            && visitedEntries < MAX_ENTRIES && hashedBytes < MAX_BYTES) {
                        visitedEntries++;
                        String id = cursor.getString(0);
                        String name = cursor.getString(1);
                        String mime = cursor.getString(2);
                        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                            pending.addLast(id);
                            continue;
                        }
                        scanned++;
                        long size = cursor.isNull(3) ? 0 : cursor.getLong(3);
                        if (size <= 0 || size > MAX_BYTES - hashedBytes) continue;
                        Uri itemUri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                        String hash = hashContent(resolver, itemUri, size);
                        if (hash == null) continue;
                        hashedBytes += size;
                        JSArray group = byHash.get(hash);
                        if (group == null) {
                            group = new JSArray();
                            byHash.put(hash, group);
                        }
                        JSObject item = new JSObject();
                        item.put("documentId", id);
                        item.put("name", name);
                        item.put("size", size);
                        group.put(item);
                    }
                }
            }
            JSArray groups = new JSArray();
            for (Map.Entry<String, JSArray> entry : byHash.entrySet()) {
                if (entry.getValue().length() > 1) {
                    JSObject group = new JSObject();
                    group.put("sha256", entry.getKey());
                    group.put("files", entry.getValue());
                    groups.put(group);
                }
            }
            JSObject out = new JSObject();
            out.put("groups", groups);
            out.put("filesScanned", scanned);
            out.put("entriesVisited", visitedEntries);
            out.put("bytesHashed", hashedBytes);
            out.put("truncated", !pending.isEmpty() || scanned >= MAX_FILES
                || visitedEntries >= MAX_ENTRIES || hashedBytes >= MAX_BYTES);
            out.put("deletesAnything", false);
            call.resolve(out);
        } catch (Exception error) {
            call.reject("ডুপ্লিকেট স্ক্যান সম্পন্ন হয়নি।", error);
        }
    }

    private static String hashContent(ContentResolver resolver, Uri uri, long expectedSize) {
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) return null;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            long total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > expectedSize || total > MAX_BYTES) return null;
                digest.update(buffer, 0, read);
            }
            StringBuilder hash = new StringBuilder();
            for (byte b : digest.digest()) {
                hash.append(String.format(java.util.Locale.ROOT, "%02x", b));
            }
            return hash.toString();
        } catch (Exception ignored) {
            return null;
        }
    }
}
