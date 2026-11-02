package com.mosharrof.agent

import android.app.AlertDialog
import android.os.Handler
import android.os.Looper
import android.widget.EditText
import android.widget.TextView
import androidx.activity.ComponentActivity
import com.mosharrof.agent.execution.AppPackageTaskAction
import com.mosharrof.agent.execution.AppPackageTaskResult
import com.mosharrof.agent.execution.AppPackageTaskResultStore
import com.mosharrof.agent.execution.AppPackageTaskStatus
import com.mosharrof.agent.execution.DeviceCommandAction
import com.mosharrof.agent.execution.DeviceCommandEnvelope
import com.mosharrof.agent.execution.DevicePairingBridge

/** Owns foreground-only pairing/polling so MainActivity stays within the file-size budget. */
class DevicePairingActivityController(
    private val activity: ComponentActivity,
    private val status: TextView,
    private val speechStatus: TextView,
    private val commandInput: EditText,
    private val dispatchCommand: (String, Boolean) -> Unit,
    private val publishResult: (AppPackageTaskResult) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())
    private var polling = false
    private var pollInFlight = false
    private val pollTask: Runnable = object : Runnable {
        override fun run() {
            if (!polling || pollInFlight) return
            pollInFlight = true
            Thread {
                val outcome = DevicePairingBridge.poll(activity)
                DevicePairingBridge.flushPendingResult(activity.applicationContext)
                activity.runOnUiThread {
                    pollInFlight = false
                    if (!polling || activity.isFinishing) return@runOnUiThread
                    when (outcome?.paired) {
                        true -> speechStatus.text = "ফোন সংযোগ: paired · foreground নিরাপদ কমান্ড পরীক্ষা চলছে"
                        false -> speechStatus.text = "ফোন সংযোগ: pairing code তৈরি; ব্রাউজারে অনুমোদনের অপেক্ষায়"
                        null -> Unit
                    }
                    outcome?.rejected?.let { handleRejectedRemoteCommand(it) }
                    outcome?.command?.let { handleRemoteCommand(it) }
                    handler.postDelayed(pollTask, 5_000L)
                }
            }.start()
        }
    }

    fun startPairing() {
        status.text = "নিরাপদ pairing শুরু হচ্ছে…"
        Thread {
            val result = runCatching { DevicePairingBridge.startPairing(activity) }
            activity.runOnUiThread {
                result.onSuccess { pairing ->
                    if (pairing.alreadyPaired) {
                        AlertDialog.Builder(activity)
                            .setTitle("MOSHARROF AI যুক্ত আছে")
                            .setMessage("এই ডিভাইস ইতিমধ্যে যুক্ত। নতুন pairing করতে হলে ব্রাউজারের Android সংযোগ প্যানেল থেকে Disconnect করুন।")
                            .setPositiveButton("ঠিক আছে", null).show()
                    } else {
                        AlertDialog.Builder(activity)
                            .setTitle("ফোন যুক্ত করার কোড")
                            .setMessage("কোড: ${pairing.pairingCode}\n\nএই কোড ৫ মিনিটের মধ্যে MOSHARROF ওয়েবসাইটের Android ফোন যুক্ত করুন প্যানেলে লিখুন। কোডটি চ্যাটে পাঠাবেন না।")
                            .setPositiveButton("ঠিক আছে", null).show()
                        status.text = "Pairing code তৈরি হয়েছে; ওয়েবসাইটে অনুমোদনের অপেক্ষায়।"
                    }
                    startPolling()
                }.onFailure { error ->
                    status.text = "ফোন যুক্ত করা যায়নি: ${error.message ?: "নেটওয়ার্ক/সার্ভার সমস্যা"}। ব্রাউজারে পুরোনো সংযোগ থাকলে Disconnect করে আবার চেষ্টা করুন।"
                }
            }
        }.start()
    }

    fun startPolling() {
        if (polling || !DevicePairingBridge.hasCredentials(activity)) return
        polling = true
        handler.removeCallbacks(pollTask)
        handler.post(pollTask)
    }

    fun stopPolling() {
        polling = false
        handler.removeCallbacks(pollTask)
    }

    private fun handleRemoteCommand(envelope: DeviceCommandEnvelope) {
        if (DevicePairingBridge.pendingRemote(activity) != null) {
            Thread { DevicePairingBridge.flushPendingResult(activity.applicationContext) }.start()
            return
        }
        if (!DevicePairingBridge.savePendingRemote(activity, envelope)) {
            status.text = "দূরবর্তী কমান্ডের আগের ফল এখনো সিঙ্ক হয়নি; নতুন কমান্ড চালানো হয়নি।"
            return
        }
        val action = appPackageAction(envelope.action)
        val received = AppPackageTaskResult(
            requestId = envelope.requestId,
            action = action,
            status = AppPackageTaskStatus.REQUESTED,
            detail = "Authenticated remote command received; Android confirmation is still required."
        )
        AppPackageTaskResultStore.save(activity, received)
        DevicePairingBridge.recordRemoteResult(activity, received)
        val command = when (envelope.action) {
            DeviceCommandAction.INSTALL_APK -> "install apk"
            DeviceCommandAction.SEARCH_PLAY_STORE -> "install ${envelope.target}"
            DeviceCommandAction.UNINSTALL_APP -> "uninstall ${envelope.target}"
        }
        commandInput.setText(command)
        dispatchCommand(command, true)
    }

    private fun handleRejectedRemoteCommand(envelope: DeviceCommandEnvelope) {
        if (!DevicePairingBridge.savePendingRemote(activity, envelope)) {
            status.text = "স্বাক্ষর যাচাই ব্যর্থ; পুরোনো কাজের ফল সিঙ্ক না হওয়ায় নতুন কমান্ড উপেক্ষা করা হয়েছে।"
            return
        }
        publishResult(
            AppPackageTaskResult(
                requestId = envelope.requestId,
                action = appPackageAction(envelope.action),
                status = AppPackageTaskStatus.FAILED,
                detail = "Signed command failed local authentication/replay validation; no phone action was executed."
            )
        )
    }

    private fun appPackageAction(action: DeviceCommandAction): AppPackageTaskAction = when (action) {
        DeviceCommandAction.INSTALL_APK -> AppPackageTaskAction.INSTALL_APK
        DeviceCommandAction.SEARCH_PLAY_STORE -> AppPackageTaskAction.SEARCH_PLAY_STORE
        DeviceCommandAction.UNINSTALL_APP -> AppPackageTaskAction.UNINSTALL_APP
    }
}
