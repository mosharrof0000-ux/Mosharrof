package com.mosharrof.agent.files

import android.content.Intent
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.documentfile.provider.DocumentFile
import android.app.AlertDialog

/** User-selected folder browser. SAF grants only the folder the device owner chooses. */
object UserFileManagerControl {
    fun addTo(activity: ComponentActivity, layout: LinearLayout, status: TextView) {
        val list = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        val stack = mutableListOf<DocumentFile>()
        fun current() = stack.lastOrNull()
        fun render(folder: DocumentFile) {
            stack.add(folder)
            list.removeAllViews()
            list.addView(TextView(activity).apply {
                text = "নির্বাচিত ফোল্ডার: ${folder.name ?: "নাম নেই"}"
                textSize = 16f
            })
            if (stack.size > 1) list.addView(Button(activity).apply {
                text = "আগের ফোল্ডারে ফিরুন"
                setOnClickListener {
                    if (stack.size > 1) stack.removeAt(stack.lastIndex)
                    current()?.let { renderCurrent(it) }
                }
            })
            val children = runCatching { folder.listFiles().toList() }.getOrDefault(emptyList())
                .sortedWith(compareByDescending<DocumentFile> { it.isDirectory }.thenBy { it.name.orEmpty().lowercase() })
            list.addView(TextView(activity).apply {
                text = "আইটেম: ${children.size}" + if (children.size >= MAX_ITEMS) " (প্রথম $MAX_ITEMS দেখানো)" else ""
            })
            children.take(MAX_ITEMS).forEach { child ->
                val row = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; setPadding(0, 10, 0, 10) }
                row.addView(TextView(activity).apply {
                    text = (if (child.isDirectory) "📁 " else "📄 ") + (child.name ?: "নাম নেই") +
                        if (child.isFile) "\n${child.type ?: "unknown"} • ${child.length()} bytes" else ""
                    textSize = 14f
                })
                if (child.isDirectory) row.addView(Button(activity).apply {
                    text = "ফোল্ডার খুলুন"
                    setOnClickListener { render(child) }
                }) else row.addView(Button(activity).apply {
                    text = "ফাইল খুলুন"
                    setOnClickListener {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(child.uri, child.type ?: "*/*")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        runCatching { activity.startActivity(intent) }
                            .onFailure { status.text = "ফাইল খোলা যায়নি: ${it.message ?: "উপযুক্ত অ্যাপ নেই"}" }
                    }
                })
                row.addView(Button(activity).apply {
                    text = "নির্বাচিত আইটেম মুছুন"
                    setOnClickListener {
                        AlertDialog.Builder(activity)
                            .setTitle("মুছে ফেলার আগে নিশ্চিত করুন")
                            .setMessage("${child.name ?: "এই আইটেম"} স্থায়ীভাবে মুছে যেতে পারে। চালিয়ে যাবেন?")
                            .setNegativeButton("বাতিল", null)
                            .setPositiveButton("মুছুন") { _, _ ->
                                val deleted = runCatching { child.delete() }.getOrDefault(false)
                                status.text = if (deleted) "আইটেম মুছে ফেলা হয়েছে।" else "ফাইল প্রদানকারী মুছতে দেয়নি।"
                                current()?.let { renderCurrent(it) }
                            }.show()
                    }
                })
                list.addView(row)
            }
        }
        fun unused() = Unit
        fun renderCurrent(folder: DocumentFile) {
            stack.removeAt(stack.lastIndex)
            render(folder)
        }
        val picker = activity.registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri: Uri? ->
            if (uri == null) {
                status.text = "ফোল্ডার নির্বাচন বাতিল হয়েছে।"
            } else {
                runCatching {
                    activity.contentResolver.takePersistableUriPermission(
                        uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    )
                }
                val root = DocumentFile.fromTreeUri(activity, uri)
                if (root == null) status.text = "নির্বাচিত ফোল্ডার খোলা যায়নি।"
                else {
                    stack.clear()
                    render(root)
                    status.text = "নির্বাচিত ফোল্ডার পড়া হয়েছে। ফাইল মুছতে প্রতিবার আলাদা নিশ্চিতকরণ লাগবে।"
                }
            }
        }
        layout.addView(Button(activity).apply {
            text = "ফাইল/ফোল্ডার নির্বাচন ও পরিচালনা"
            setOnClickListener { picker.launch(null) }
        })
        layout.addView(list)
    }

    private const val MAX_ITEMS = 100
}
