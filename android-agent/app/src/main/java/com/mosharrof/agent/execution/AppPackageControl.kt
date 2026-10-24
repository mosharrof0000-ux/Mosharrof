package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.widget.TextView
import java.util.UUID

/** Routes bounded commands to small, feature-specific package controllers. */
object AppPackageControl {
    fun handleCommand(
        activity: Activity,
        rawCommand: String,
        status: TextView,
        pickApk: () -> Unit,
        onTaskResult: (AppPackageTaskResult) -> Unit = {}
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
                val query = command.query
                AlertDialog.Builder(activity)
                    .setTitle("অ্যাপ খুঁজুন")
                    .setMessage("\\"$query\\" অ্যাপটি Play Store-এ খোঁজা হবে। ইনস্টল ও অনুমতির চূড়ান্ত সিদ্ধান্ত আপনার হাতে থাকবে।")
                    .setNegativeButton("বাতিল") { _, _ ->
                        val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE,
                            AppPackageTaskStatus.CANCELLED, "ব্যবহারকারী Play Store খোলা বাতিল করেছেন।")
                        onTaskResult(outcome)
                        status.text = outcome.toDisplayText()
                    }
                    .setPositiveButton("Play Store খুলুন") { _, _ ->
                        val market = Uri.parse("market://search?q=" + Uri.encode(query))
                        try {
                            activity.startActivity(Intent(Intent.ACTION_VIEW, market))
                            val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE,
                                AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
                                "Play Store সার্চ খোলা হয়েছে; এটি ইনস্টল সফল হওয়ার প্রমাণ নয়।")
                            onTaskResult(outcome)
                            status.text = outcome.toDisplayText()
                        } catch (_: Exception) {
                            val web = Uri.parse("https://play.google.com/store/search?q=" + Uri.encode(query) + "&c=apps")
                            runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, web)) }
                                .onSuccess {
                                    val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE,
                                        AppPackageTaskStatus.AWAITING_USER_CONFIRMATION,
                                        "ওয়েব সার্চ খোলা হয়েছে; এটি ইনস্টল সফল হওয়ার প্রমাণ নয়।")
                                    onTaskResult(outcome)
                                    status.text = outcome.toDisplayText()
                                }
                                .onFailure {
                                    val outcome = result(requestId, AppPackageTaskAction.SEARCH_PLAY_STORE,
                                        AppPackageTaskStatus.FAILED, "অ্যাপ খোঁজার পেজ খোলা যায়নি।")
                                    onTaskResult(outcome)
                                    status.text = outcome.toDisplayText()
                                }
                        }
                    }.show()
                true
            }
            is AppPackageCommand.Uninstall -> {
                val requestId = newRequestId()
                val packageName = AppPackageUninstallControl.resolveInstalledLauncherPackage(activity, command.target)
                if (packageName == null) {
                    val outcome = result(requestId, AppPackageTaskAction.UNINSTALL_APP,
                        AppPackageTaskStatus.FAILED, "মিল থাকা ইনস্টল করা অ্যাপ পাওয়া যায়নি; কোনো অ্যাপ সরানো হয়নি।")
                    onTaskResult(outcome)
                    status.text = outcome.toDisplayText()
                } else {
                    AppPackageUninstallControl.requestUninstall(activity, packageName, status, requestId, onTaskResult)
                }
                true
            }
        }
    }

    fun requestInstallFromSelectedUri(
        activity: Activity,
        apkUri: Uri,
        status: TextView,
        onTaskResult: (AppPackageTaskResult) -> Unit = {}
    ) = AppPackageInstallControl.requestInstallFromSelectedUri(activity, apkUri, status, onTaskResult)

    fun requestUninstall(
        activity: Activity,
        packageName: String,
        status: TextView,
        requestId: String = newRequestId(),
        onTaskResult: (AppPackageTaskResult) -> Unit = {}
    ) = AppPackageUninstallControl.requestUninstall(activity, packageName, status, requestId, onTaskResult)

    private fun newRequestId(): String = UUID.randomUUID().toString()

    private fun result(
        requestId: String,
        action: AppPackageTaskAction,
        taskStatus: AppPackageTaskStatus,
        detail: String
    ) = AppPackageTaskResult(requestId, action, taskStatus, detail)

    private fun AppPackageTaskResult.toDisplayText(): String =
        "কাজের ফল: $status • ID: $requestId\n$detail"
}
