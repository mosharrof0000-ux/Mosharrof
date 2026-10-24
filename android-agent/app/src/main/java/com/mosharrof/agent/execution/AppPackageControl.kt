package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.TextView
import java.io.File
import java.util.UUID

/** User-directed app installation/removal; Android retains final confirmation. */
object AppPackageControl {
    private const val MAX_APK_BYTES = 300L * 1024L * 1024L

    private data class ApkMetadata(
        val packageName: String,
        val versionCode: Long,
        val previousVersionCode: Long?
    )

    fun handleCommand(
        activity: Activity, rawCommand: String, status: TextView, pickApk: () -> Unit,
        onTaskResult: (AppPackageTaskResult) -> Unit = {}
    ): Boolean = when (val command = AppPackageCommandParser.parse(rawCommand)) {
        AppPackageCommand.NotRecognized -> false
        AppPackageCommand.PickApk -> {
            status.text = "Android ফাইল পিকার থেকে APK নির্বাচন করুন।"
            pickApk()
            true
        }
        AppPackageCommand.AskUninstallTarget -> {
            status.text = "কোন ইনস্টল করা অ্যাপটি আনইনস্টল করতে হবে তার সঠিক নাম বলুন।"
            true
        }
        is AppPackageCommand.SearchStore -> {
            val requestId = newRequestId()
            AlertDialog.Builder(activity)
                .setTitle("অ্যাপ খুঁজুন")
                .setMessage("\"${command.query}\" অ্যাপটি Play Store-এ খোঁজা হবে। ইনস্টল ও অনুমতির চূড়ান্ত সিদ্ধান্ত আপনার হাতে থাকবে।")
                .setNegativeButton("বাতিল") { _, _ ->
                    val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE, AppPackageTaskStatus.CANCELLED, "ব্যবহারকারী Play Store খোলা বাতিল করেছেন।")
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                }
                .setPositiveButton("Play Store খুলুন") { _, _ ->
                    val market = Uri.parse("market://search?q=" + Uri.encode(command.query))
                    try {
                        activity.startActivity(Intent(Intent.ACTION_VIEW, market))
                        val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION, "Play Store সার্চ খোলা হয়েছে; এটি ইনস্টল সফল হওয়ার প্রমাণ নয়।")
                        onTaskResult(outcome)
                        status.text = outcome.toDisplayText()
                    } catch (_: Exception) {
                        val web = Uri.parse("https://play.google.com/store/search?q=" + Uri.encode(command.query) + "&c=apps")
                        runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, web)) }
                            .onSuccess {
                                val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION, "ওয়েব সার্চ খোলা হয়েছে; এটি ইনস্টল সফল হওয়ার প্রমাণ নয়।")
                                onTaskResult(outcome)
                                status.text = outcome.toDisplayText()
                            }
                            .onFailure {
                                val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE, AppPackageTaskStatus.FAILED, "অ্যাপ খোঁজার পেজ খোলা যায়নি।")
                                onTaskResult(outcome)
                                status.text = outcome.toDisplayText()
                            }
                    }
                }.show()
            true
        }
        is AppPackageCommand.Uninstall -> {
            val requestId = newRequestId()
            val packageName = resolveInstalledLauncherPackage(activity, command.target)
            if (packageName == null) {
                val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.FAILED, "মিল থাকা ইনস্টল করা অ্যাপ পাওয়া যায়নি; কোনো অ্যাপ সরানো হয়নি।")
                onTaskResult(outcome)
                status.text = outcome.toDisplayText()
            } else requestUninstall(activity, packageName, status, requestId, onTaskResult)
            true
        }
    }

    private fun resolveInstalledLauncherPackage(activity: Activity, query: String): String? {
        val normalized = query.trim()
        if (PACKAGE_NAME.matches(normalized)) return if (isPackageInstalled(activity, normalized)) normalized else null
        val wanted = normalized.lowercase()
        return try {
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            @Suppress("DEPRECATION")
            activity.packageManager.queryIntentActivities(launcherIntent, 0)
                .filter { it.loadLabel(activity.packageManager).toString().trim().lowercase() == wanted }
                .map { it.activityInfo.packageName }
                .distinct()
                .singleOrNull()
        } catch (_: Exception) { null }
    }

    fun requestInstallFromSelectedUri(activity: Activity, apkUri: Uri, status: TextView, onTaskResult: (AppPackageTaskResult) -> Unit = {}) {
        val requestId = newRequestId()
        if (apkUri.scheme != "content") {
            val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.FAILED, "নিরাপদ ইনস্টলের জন্য Android ফাইল পিকার থেকে APK নির্বাচন করুন।")
            onTaskResult(outcome)
            status.text = outcome.toDisplayText()
            return
        }
        val metadata = inspectApk(activity, apkUri)
        if (metadata == null) {
            val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.FAILED, "APK-এর package/version metadata পড়া যায়নি বা ফাইলটি ৩০০ MB-এর বেশি; ইনস্টলার খোলা হয়নি।")
            onTaskResult(outcome)
            status.text = outcome.toDisplayText()
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ ইনস্টল করার আগে যাচাই")
            .setMessage("APK: ${metadata.packageName}\nVersion: ${metadata.versionCode}\nAndroid-এর প্যাকেজ ইনস্টলার খুলবে। অচেনা উৎসের APK ইনস্টল করবেন না।")
            .setNegativeButton("বাতিল") { _, _ ->
                val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.CANCELLED, "ব্যবহারকারী ইনস্টলার খোলা বাতিল করেছেন।", metadata.packageName, metadata.versionCode, metadata.previousVersionCode)
                onTaskResult(outcome)
                status.text = outcome.toDisplayText()
            }
            .setPositiveButton("ইনস্টলার খুলুন") { _, _ ->
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try {
                    AppPackagePendingOperationStore.beginInstall(activity, requestId, metadata.packageName, metadata.versionCode, metadata.previousVersionCode)
                    activity.startActivity(intent)
                    val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION, "Android ইনস্টলার খোলা হয়েছে; ফিরে এলে package/version যাচাই হবে।", metadata.packageName, metadata.versionCode, metadata.previousVersionCode)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                } catch (_: Exception) {
                    AppPackagePendingOperationStore.clear(activity)
                    val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.FAILED, "এই ডিভাইসে উপযুক্ত প্যাকেজ ইনস্টলার খোলা যায়নি।", metadata.packageName, metadata.versionCode, metadata.previousVersionCode)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                }
            }.show()
    }

    private fun inspectApk(activity: Activity, uri: Uri): ApkMetadata? {
        val file = runCatching { File.createTempFile("mosharrof-apk-", ".apk", activity.cacheDir) }.getOrNull() ?: return null
        return try {
            val input = activity.contentResolver.openInputStream(uri) ?: return null
            input.use { source ->
                file.outputStream().use { sink ->
                    val buffer = ByteArray(8192)
                    var total = 0L
                    while (true) {
                        val count = source.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > MAX_APK_BYTES) throw IllegalArgumentException("APK exceeds size limit")
                        sink.write(buffer, 0, count)
                    }
                }
            }
            @Suppress("DEPRECATION")
            val archive: PackageInfo = activity.packageManager.getPackageArchiveInfo(file.absolutePath, 0) ?: return null
            val packageName = archive.packageName?.takeIf { PACKAGE_NAME.matches(it) } ?: return null
            val versionCode = if (android.os.Build.VERSION.SDK_INT >= 28) archive.longVersionCode else archive.versionCode.toLong()
            val previousVersionCode = try {
                @Suppress("DEPRECATION")
                val existing = activity.packageManager.getPackageInfo(packageName, 0)
                if (android.os.Build.VERSION.SDK_INT >= 28) existing.longVersionCode else existing.versionCode.toLong()
            } catch (_: PackageManager.NameNotFoundException) {
                null
            } catch (_: Exception) {
                null
            }
            ApkMetadata(packageName, versionCode, previousVersionCode)
        } catch (_: Exception) {
            null
        } finally {
            file.delete()
        }
    }

    fun requestUninstall(activity: Activity, packageName: String, status: TextView, requestId: String = newRequestId(), onTaskResult: (AppPackageTaskResult) -> Unit = {}) {
        val normalized = packageName.trim()
        if (!PACKAGE_NAME.matches(normalized) || normalized == activity.packageName || !isPackageInstalled(activity, normalized)) {
            val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.FAILED, "অ্যাপের package name ভুল, নিজের অ্যাপ, বা ইনস্টল করা অ্যাপের সঙ্গে মেলেনি; কিছু সরানো হয়নি。", normalized)
            onTaskResult(outcome)
            status.text = outcome.toDisplayText()
            return
        }
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ আনইনস্টল")
            .setMessage("${normalized} অ্যাপটির Android আনইনস্টল স্ক্রিন খোলা হবে। চূড়ান্ত সিদ্ধান্ত সেখানে নিশ্চিত করতে হবে।")
            .setNegativeButton("বাতিল") { _, _ ->
                val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.CANCELLED, "ব্যবহারকারী আনইনস্টল বাতিল করেছেন।", normalized)
                onTaskResult(outcome)
                status.text = outcome.toDisplayText()
            }
            .setPositiveButton("আনইনস্টল স্ক্রিন খুলুন") { _, _ ->
                try {
                    AppPackagePendingOperationStore.beginUninstall(activity, requestId, normalized)
                    activity.startActivity(Intent(Intent.ACTION_DELETE, Uri.parse("package:$normalized")))
                    val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION, "Android আনইনস্টল স্ক্রিন খোলা হয়েছে; ফিরে এলে প্যাকেজের অবস্থা যাচাই হবে।", normalized)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                } catch (_: Exception) {
                    AppPackagePendingOperationStore.clear(activity)
                    val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.FAILED, "Android-এর আনইনস্টল স্ক্রিন খোলা যায়নি।", normalized)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                }
            }.show()
    }

    fun isPackageInstalled(activity: Activity, packageName: String): Boolean = try {
        @Suppress("DEPRECATION")
        activity.packageManager.getApplicationInfo(packageName, 0)
        true
    } catch (_: Exception) { false }

    private fun newRequestId(): String = UUID.randomUUID().toString()

    private fun result(
        requestId: String,
        action: AppPackageTaskAction,
        taskStatus: AppPackageTaskStatus,
        detail: String,
        packageName: String? = null,
        expectedVersionCode: Long? = null,
        previousVersionCode: Long? = null
    ) = AppPackageTaskResult(
        requestId, action, taskStatus, detail, packageName,
        packageStateVerified = false,
        expectedVersionCode = expectedVersionCode,
        previousVersionCode = previousVersionCode
    )

    private fun AppPackageTaskResult.toDisplayText(): String = "কাজের ফল: $status • ID: $requestId\n$detail"
    private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")
}
