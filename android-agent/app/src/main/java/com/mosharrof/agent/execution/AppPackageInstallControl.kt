package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageInfo
import android.net.Uri
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.io.File
import java.util.UUID

/** APK metadata inspection and Android-owned install confirmation, isolated from command routing. */
object AppPackageInstallControl {
    private data class ApkMetadata(val packageName: String, val versionCode: Long)
    private const val MAX_APK_BYTES = 512L * 1024L * 1024L
    private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")

    fun addInstallButton(activity: Activity, parent: LinearLayout, launchPicker: () -> Unit) {
        parent.addView(Button(activity).apply {
            text = "APK ফাইল থেকে অ্যাপ ইনস্টল করুন"
            setOnClickListener { launchPicker() }
        })
    }

    fun requestInstallFromSelectedUri(
        activity: Activity,
        apkUri: Uri,
        status: TextView,
        onTaskResult: (AppPackageTaskResult) -> Unit = {}
    ) {
        val requestId = UUID.randomUUID().toString()
        val metadata = inspectApk(activity, apkUri)
        if (metadata == null) {
            val outcome = result(requestId, AppPackageTaskStatus.FAILED,
                "APK-এর প্যাকেজ/ভার্সন পড়া যায়নি বা ফাইলটি সমর্থিত নয়; ইনস্টলার খোলা হয়নি।")
            onTaskResult(outcome)
            status.text = outcome.toDisplayText()
            return
        }

        val packageName = metadata.packageName
        val expectedVersion = metadata.versionCode
        val previousVersion = installedVersionCode(activity, packageName)
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ ইনস্টল করার আগে যাচাই")
            .setMessage("প্যাকেজ: $packageName\nAndroid-এর প্যাকেজ ইনস্টলার খুলবে। অচেনা উৎসের APK ইনস্টল করবেন না। Android-এর নিজস্ব অনুমতি ও নিশ্চিতকরণ লাগবে।")
            .setNegativeButton("বাতিল") { _, _ ->
                val outcome = result(requestId, AppPackageTaskStatus.CANCELLED,
                    "ব্যবহারকারী ইনস্টলার খোলা বাতিল করেছেন।", packageName, expectedVersion, previousVersion)
                onTaskResult(outcome)
                status.text = outcome.toDisplayText()
            }
            .setPositiveButton("ইনস্টলার খুলুন") { _, _ ->
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try {
                    AppPackagePendingOperationStore.beginInstall(
                        activity, requestId, packageName, expectedVersion, previousVersion
                    )
                    activity.startActivity(intent)
                    val outcome = result(requestId, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
                        "Android ইনস্টলার খোলা হয়েছে; ফিরে এলে প্যাকেজ ও ভার্সন যাচাই করা হবে。",
                        packageName, expectedVersion, previousVersion)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                } catch (_: Exception) {
                    AppPackagePendingOperationStore.clear(activity)
                    val outcome = result(requestId, AppPackageTaskStatus.FAILED,
                        "এই ডিভাইসে উপযুক্ত প্যাকেজ ইনস্টলার খোলা যায়নি।", packageName, expectedVersion, previousVersion)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                }
            }.show()
    }

    private fun inspectApk(activity: Activity, apkUri: Uri): ApkMetadata? {
        if (apkUri.scheme != "content") return null
        val temp = runCatching {
            File.createTempFile("mosharrof-apk-", ".apk", activity.cacheDir)
        }.getOrNull() ?: return null
        return try {
            val input = activity.contentResolver.openInputStream(apkUri) ?: return null
            input.use { source ->
                temp.outputStream().use { output ->
                    val buffer = ByteArray(16 * 1024)
                    var total = 0L
                    while (true) {
                        val read = source.read(buffer)
                        if (read < 0) break
                        total += read
                        if (total > MAX_APK_BYTES) return null
                        output.write(buffer, 0, read)
                    }
                }
            }
            @Suppress("DEPRECATION")
            val info = activity.packageManager.getPackageArchiveInfo(temp.absolutePath, 0) ?: return null
            val packageName = info.packageName ?: return null
            if (!PACKAGE_NAME.matches(packageName)) return null
            ApkMetadata(packageName, packageVersionCode(info))
        } catch (_: Exception) {
            null
        } finally {
            temp.delete()
        }
    }

    private fun installedVersionCode(activity: Activity, packageName: String): Long? = try {
        @Suppress("DEPRECATION")
        packageVersionCode(activity.packageManager.getPackageInfo(packageName, 0))
    } catch (_: Exception) {
        null
    }

    private fun packageVersionCode(info: PackageInfo): Long =
        if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }

    private fun result(
        requestId: String,
        taskStatus: AppPackageTaskStatus,
        detail: String,
        packageName: String? = null,
        expectedVersionCode: Long? = null,
        previousVersionCode: Long? = null
    ) = AppPackageTaskResult(
        requestId = requestId,
        action = AppPackageTaskAction.INSTALL_APK,
        status = taskStatus,
        detail = detail,
        packageName = packageName,
        expectedVersionCode = expectedVersionCode,
        previousVersionCode = previousVersionCode
    )

    private fun AppPackageTaskResult.toDisplayText(): String =
        "কাজের ফল: $status • ID: $requestId\n$detail"
}
