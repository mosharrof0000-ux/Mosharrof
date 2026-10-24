package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.widget.TextView
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID

/**
 * User-directed app installation/removal.
 * Android's package installer, Play Store, and uninstaller retain final control and confirmation.
 */
object AppPackageControl {
    fun handleCommand(
        activity: Activity, rawCommand: String, status: TextView, pickApk: () -> Unit,
        onTaskResult: (AppPackageTaskResult) -> Unit = {},
        launchConfirmation: (Intent) -> Unit = { activity.startActivity(it) }
    ): Boolean {
        return when (val command = AppPackageCommandParser.parse(rawCommand)) {
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
                } else requestUninstall(activity, packageName, status, requestId, onTaskResult, launchConfirmation)
                true
            }
        }
    }

    private fun resolveInstalledLauncherPackage(activity: Activity, query: String): String? {
        val normalized = query.trim()
        if (PACKAGE_NAME.matches(normalized)) return if (isInstalled(activity, normalized)) normalized else null
        val wanted = normalized.lowercase()
        return try {
            val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            @Suppress("DEPRECATION")
            val matches = activity.packageManager.queryIntentActivities(launcherIntent, 0)
                .filter { info -> info.loadLabel(activity.packageManager).toString().trim().lowercase() == wanted }
                .map { it.activityInfo.packageName }
                .distinct()
            matches.singleOrNull()
        } catch (_: Exception) { null }
    }

    fun requestInstallFromSelectedUri(
        activity: Activity,
        apkUri: Uri,
        status: TextView,
        onTaskResult: (AppPackageTaskResult) -> Unit = {},
        launchConfirmation: (Intent) -> Unit = { activity.startActivity(it) }
    ) {
        if (apkUri.scheme != "content") {
            val outcome = result(newRequestId(), AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.FAILED,
                "নিরাপদ ইনস্টলের জন্য Android ফাইল পিকার থেকে APK নির্বাচন করুন।")
            onTaskResult(outcome)
            status.text = outcome.toDisplayText()
            return
        }
        val requestId = newRequestId()
        AlertDialog.Builder(activity)
            .setTitle("অ্যাপ ইনস্টল করার আগে যাচাই")
            .setMessage("Android-এর প্যাকেজ ইনস্টলার খুলবে। অচেনা উৎসের APK ইনস্টল করবেন না। Android-এর নিজস্ব অনুমতি ও নিশ্চিতকরণ লাগবে।")
            .setNegativeButton("বাতিল") { _, _ ->
                val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.CANCELLED, "ব্যবহারকারী ইনস্টলার খোলা বাতিল করেছেন।")
                onTaskResult(outcome)
                status.text = outcome.toDisplayText()
            }
            .setPositiveButton("ইনস্টলার খুলুন") { _, _ ->
                val metadata = inspectApk(activity, apkUri)
                if (metadata == null || metadata.packageName == activity.packageName) {
                    val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.FAILED,
                        if (metadata == null) "APK ফাইল পড়া যায়নি বা APK বৈধ নয়; কোনো ইনস্টল শুরু হয়নি।"
                        else "নিজস্ব এজেন্ট প্যাকেজের উপর এই ইনস্টল-পথ ব্যবহার করা যাবে না।")
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                    return@setPositiveButton
                }
                val previousVersion = installedVersionCode(activity, metadata.packageName)
                PendingAppPackageOperationStore.save(activity, PendingAppPackageOperation(
                    requestId = requestId,
                    action = AppPackageTaskAction.INSTALL_APK,
                    packageName = metadata.packageName,
                    expectedVersionCode = metadata.versionCode,
                    wasInstalled = previousVersion != null,
                    previousVersionCode = previousVersion
                ))
                val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                    setDataAndType(apkUri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                try {
                    launchConfirmation(intent)
                    val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
                        "Android ইনস্টলার খোলা হয়েছে; ফিরে আসার পর প্যাকেজ ও সংস্করণ যাচাই হবে।", metadata.packageName)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                } catch (_: Exception) {
                    PendingAppPackageOperationStore.clear(activity)
                    val outcome = result(requestId, AppPackageTaskAction.INSTALL_APK, AppPackageTaskStatus.FAILED,
                        "এই ডিভাইসে উপযুক্ত প্যাকেজ ইনস্টলার খোলা যায়নি।", metadata.packageName)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                }
            }.show()
    }

    fun requestUninstall(
        activity: Activity,
        packageName: String,
        status: TextView,
        requestId: String = newRequestId(),
        onTaskResult: (AppPackageTaskResult) -> Unit = {},
        launchConfirmation: (Intent) -> Unit = { activity.startActivity(it) }
    ) {
        val normalized = packageName.trim()
        if (!PACKAGE_NAME.matches(normalized) || normalized == activity.packageName || !isInstalled(activity, normalized)) {
            val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.FAILED, "অ্যাপের package name ভুল, নিজের অ্যাপ, বা ইনস্টল করা অ্যাপের সঙ্গে মেলেনি; কিছু সরানো হয়নি।")
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
                PendingAppPackageOperationStore.save(activity, PendingAppPackageOperation(
                    requestId = requestId,
                    action = AppPackageTaskAction.UNINSTALL_APP,
                    packageName = normalized,
                    wasInstalled = true,
                    previousVersionCode = installedVersionCode(activity, normalized)
                ))
                try {
                    launchConfirmation(Intent(Intent.ACTION_DELETE, Uri.parse("package:$normalized")))
                    val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
                        "Android আনইনস্টল স্ক্রিন খোলা হয়েছে; ফিরে আসার পর প্যাকেজ-অবস্থা যাচাই হবে।", normalized)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                } catch (_: Exception) {
                    PendingAppPackageOperationStore.clear(activity)
                    val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP, AppPackageTaskStatus.FAILED,
                        "Android-এর আনইনস্টল স্ক্রিন খোলা যায়নি।", normalized)
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                }
            }.show()
    }

    /** Called after Android returns from its installer/uninstaller confirmation screen. */
    fun completePendingOperation(
        activity: Activity,
        resultCode: Int,
        status: TextView,
        onTaskResult: (AppPackageTaskResult) -> Unit
    ) {
        val pending = PendingAppPackageOperationStore.latest(activity) ?: return
        PendingAppPackageOperationStore.clear(activity)
        val installedVersion = installedVersionCode(activity, pending.packageName)
        val outcome = AppPackageStateOutcomeResolver.resolve(pending, resultCode, installedVersion)
        onTaskResult(outcome)
        status.text = outcome.toDisplayText()
    }

    private data class ApkMetadata(val packageName: String, val versionCode: Long)

    private fun inspectApk(activity: Activity, apkUri: Uri): ApkMetadata? {
        val temp = runCatching { File.createTempFile("mosharrof-apk-", ".apk", activity.cacheDir) }.getOrNull() ?: return null
        return try {
            val input = activity.contentResolver.openInputStream(apkUri) ?: return null
            input.use { source ->
                FileOutputStream(temp).use { destination ->
                    val buffer = ByteArray(16 * 1024)
                    var total = 0L
                    while (true) {
                        val count = source.read(buffer)
                        if (count < 0) break
                        total += count
                        if (total > MAX_APK_BYTES) throw IOException("APK exceeds safe inspection limit")
                        destination.write(buffer, 0, count)
                    }
                }
            }
            @Suppress("DEPRECATION")
            val info = activity.packageManager.getPackageArchiveInfo(temp.absolutePath, 0) ?: return null
            ApkMetadata(info.packageName, if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong())
        } catch (_: Exception) {
            null
        } finally {
            temp.delete()
        }
    }

    private fun installedVersionCode(activity: Activity, packageName: String): Long? = try {
        @Suppress("DEPRECATION")
        val info = activity.packageManager.getPackageInfo(packageName, 0)
        if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
    } catch (_: Exception) { null }

    private fun isInstalled(activity: Activity, packageName: String): Boolean = installedVersionCode(activity, packageName) != null

    private fun newRequestId(): String = UUID.randomUUID().toString()

    private fun result(
        requestId: String,
        action: AppPackageTaskAction,
        taskStatus: AppPackageTaskStatus,
        detail: String,
        packageName: String? = null,
        packageStateVerified: Boolean = false
    ) = AppPackageTaskResult(requestId, action, taskStatus, detail, packageName, packageStateVerified)

    private fun AppPackageTaskResult.toDisplayText(): String = "কাজের ফল: $status • ID: $requestId\n$detail"

    private val MAX_APK_BYTES = 512L * 1024 * 1024
    private val PACKAGE_NAME = Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+")
}
