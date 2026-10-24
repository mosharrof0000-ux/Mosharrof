package com.mosharrof.agent
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognizerIntent
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.getSystemService
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService
import com.mosharrof.agent.accessibility.ScreenshotAnalysisControl
import com.mosharrof.agent.diagnostics.DeviceDiagnosticsControl
import com.mosharrof.agent.execution.AccessibilityConsentDialog
import com.mosharrof.agent.execution.AgentTaskController
import com.mosharrof.agent.execution.AppPackageControl
import com.mosharrof.agent.execution.AppPackagePendingOperationStore
import com.mosharrof.agent.execution.AppPackageTaskAction
import com.mosharrof.agent.execution.AppPackageTaskResult
import com.mosharrof.agent.execution.AppPackageTaskResultStore
import com.mosharrof.agent.execution.AppPackageTaskStatus
import com.mosharrof.agent.execution.DeviceIntentControl
import com.mosharrof.agent.execution.DeviceCommandAction
import com.mosharrof.agent.execution.DeviceCommandAuthenticator
import com.mosharrof.agent.execution.DeviceCommandEnvelope
import com.mosharrof.agent.execution.DeviceCommandReplayStore
import com.mosharrof.agent.execution.DevicePairingSecretStore
import com.mosharrof.agent.execution.TaskControlButtons
import com.mosharrof.agent.execution.ScreenInspectionController
import com.mosharrof.agent.voice.AgentSpeechOutput
import com.mosharrof.agent.voice.SpeechOutputControls
import com.mosharrof.agent.permissions.CapabilityPermissionCenter
import com.mosharrof.agent.notifications.NotificationAccessControl
import com.mosharrof.agent.files.UserFileAccessControl
import com.mosharrof.agent.admin.ManagedDeviceControl
import com.mosharrof.agent.planner.AiCommandNormalizer
import com.mosharrof.agent.permissions.PermissionCenterControl
class MainActivity : ComponentActivity() {
    private lateinit var taskController: AgentTaskController
    private lateinit var status: TextView
    private lateinit var speechStatus: TextView
    private lateinit var screenDetails: TextView
    private lateinit var screenInspectionController: ScreenInspectionController
    private lateinit var commandInput: EditText
    private lateinit var confirmButton: Button
    private var speechOutput: AgentSpeechOutput? = null
    private var pendingExternalRequestId: String? = null
    private var externalCallback: Uri? = null
    private val deviceCommandAuthenticator by lazy { DeviceCommandAuthenticator() }
    private val permissionResult = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val granted = grants.count { it.value }
        val denied = grants.size - granted
        status.text = "অনুমতি ফলাফল: ${granted}টি অনুমোদিত, ${denied}টি অননুমোদিত। বিশেষ অনুমতিগুলো নিচের Settings বোতাম থেকে চালু করুন।"
    }
    private val folderPicker = registerForActivityResult(ActivityResultContracts.OpenDocumentTree()) { uri ->
        if (::status.isInitialized) UserFileAccessControl.scanSelectedFolder(this, uri, status)
    }
    private val apkPicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val requestId = pendingExternalRequestId ?: java.util.UUID.randomUUID().toString()
        pendingExternalRequestId = null
        if (uri != null) AppPackageControl.requestInstallFromSelectedUri(
            this, uri, status, ::publishAppPackageResult, requestIdOverride = requestId
        )
        else publishAppPackageResult(
            AppPackageTaskResult(
                requestId = requestId,
                action = AppPackageTaskAction.INSTALL_APK,
                status = AppPackageTaskStatus.CANCELLED,
                detail = "APK নির্বাচন বাতিল করা হয়েছে; কোনো অ্যাপ ইনস্টল হয়নি।"
            )
        )
    }
    private val speechResult = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()?.takeIf { it.isNotBlank() }?.let {
                commandInput.setText(it)
                prepareCommand(it)
            }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val title = TextView(this).apply {
            text = "মোশাররফ অটোনোমাস এজেন্ট"
            textSize = 24f
            contentDescription = "Mosharrof Autonomous Agent"
        }
        status = TextView(this).apply { textSize = 16f }
        speechStatus = TextView(this).apply { textSize = 14f }
        speechOutput = AgentSpeechOutput(this) { message -> runOnUiThread { speechStatus.text = message } }
        screenDetails = TextView(this).apply { textSize = 14f }
        screenInspectionController = ScreenInspectionController(this, status, screenDetails, ::isServiceEnabled)
        commandInput = EditText(this).apply {
            hint = "যেমন: Open YouTube / ইউটিউব খুলুন"
            setSingleLine(true)
        }
        confirmButton = Button(this).apply {
            text = "নিশ্চিত করে চালান"
            isEnabled = false
        }
        taskController = AgentTaskController(this, status, confirmButton, ::isServiceEnabled)
        confirmButton.setOnClickListener { taskController.confirmPending() }
        val planButton = Button(this).apply {
            text = "কমান্ড যাচাই করুন"
            setOnClickListener {
                val command = commandInput.text.toString()
                prepareCommand(command)
            }
        }
        val voiceButton = Button(this).apply {
            text = "কথা বলে কমান্ড দিন"
            setOnClickListener { startSpeechInput() }
        }
        val inspectButton = Button(this).apply {
            text = "বর্তমান স্ক্রিন পরীক্ষা করুন"
            setOnClickListener { screenInspectionController.inspect() }
        }
        val accessibilityButton = Button(this).apply {
            text = "Accessibility সেটিংস খুলুন"
            setOnClickListener {
                AccessibilityConsentDialog.show(this@MainActivity) {
                    startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                }
            }
        }
        setContentView(ScrollView(this).apply {
            addView(LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 32)
            addView(title)
            addView(status)
            addView(speechStatus)
            addView(commandInput)
            addView(voiceButton)
            addView(planButton)
            addView(confirmButton)
            SpeechOutputControls.addTo(this@MainActivity, this, speechOutput, status)
            TaskControlButtons.addCancelButton(this@MainActivity, this) { taskController.cancelPending() }
            addView(inspectButton)
            ScreenshotAnalysisControl.addTo(this@MainActivity, this, status, ::isServiceEnabled, ::prepareCommand)
            addView(screenDetails)
            DeviceDiagnosticsControl.addTo(this@MainActivity, this)
            UserFileAccessControl.addTo(this@MainActivity, this, status) { folderPicker.launch(null) }
            addView(Button(this@MainActivity).apply {
                text = "Mosharrof Web-এর সঙ্গে যুক্ত করুন"
                setOnClickListener { showPairingKey() }
            })
            addView(Button(this@MainActivity).apply {
                text = "APK ফাইল থেকে অ্যাপ ইনস্টল করুন"
                setOnClickListener { apkPicker.launch(arrayOf("application/vnd.android.package-archive")) }
            })
            addView(Button(this@MainActivity).apply {
                text = "সমস্ত runtime permission চাইুন"
                setOnClickListener { permissionResult.launch(PermissionCenterControl.runtimePermissions) }
            })
            CapabilityPermissionCenter.addButton(this@MainActivity, this)
            ManagedDeviceControl.addTo(this@MainActivity, this, status)
            NotificationAccessControl.addTo(this@MainActivity, this)
            addView(accessibilityButton)
        })
        })
        refreshServiceStatus()
        val externalCommandHandled = handleExternalCommand(intent)
        if (!externalCommandHandled && intent.getBooleanExtra(EXTRA_START_VOICE, false)) {
            intent.removeExtra(EXTRA_START_VOICE)
            window.decorView.post { startSpeechInput() }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val externalCommandHandled = handleExternalCommand(intent)
        if (!externalCommandHandled && intent.getBooleanExtra(EXTRA_START_VOICE, false)) {
            intent.removeExtra(EXTRA_START_VOICE)
            window.decorView.post { startSpeechInput() }
        }
    }
    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) {
            val packageResult = AppPackagePendingOperationStore.resolveAfterReturn(this)
            if (packageResult != null) {
                publishAppPackageResult(packageResult)
                return
            }
            val actionResult = MosharrofAccessibilityService.takeActionResult()
            if (actionResult != null) status.text = actionResult else refreshServiceStatus()
        }
    }
    private fun prepareCommand(command: String) {
        if (AppPackageControl.handleCommand(
                this, command, status,
                pickApk = { apkPicker.launch(arrayOf("application/vnd.android.package-archive")) },
                onTaskResult = ::publishAppPackageResult
            )) return
        if (DeviceIntentControl.handle(this, command, status)) return
        if (taskController.prepareTask(command)) return
        status.text = "স্থানীয় কমান্ডে কাজটি বোঝা যায়নি; AI-কে সমর্থিত Android কমান্ডে রূপান্তর করতে বলা হচ্ছে…"
        AiCommandNormalizer.resolve(command, taskController.installedAppLabels()) { result, error ->
            runOnUiThread {
                if (isFinishing) return@runOnUiThread
                if (error != null) {
                    status.text = "AI কমান্ড সহায়তা ব্যর্থ: $error"
                    return@runOnUiThread
                }
                val normalized = result?.normalizedCommand
                if (normalized.isNullOrBlank()) {
                    status.text = result?.explanation ?: "AI নিরাপদ, সমর্থিত কমান্ড দিতে পারেনি।"
                    return@runOnUiThread
                }
                commandInput.setText(normalized)
                if (taskController.prepareTask(normalized)) {
                    status.text = "AI ব্যাখ্যা: ${result.explanation}\nপ্রস্তাবিত কমান্ডটি যাচাই করুন; চালাতে ‘নিশ্চিত করে চালান’ চাপুন।"
                } else {
                    status.text = "AI একটি কমান্ড প্রস্তাব করেছে, কিন্তু স্থানীয় নীতি সেটি প্রত্যাখ্যান করেছে। কোনো কাজ চালানো হয়নি।"
                }
            }
        }
    }
    private fun publishAppPackageResult(result: AppPackageTaskResult) {
        lastAppPackageTaskResult = result
        AppPackageTaskResultStore.save(this, result)
        status.text = "কাজের ফল: ${result.status} • ID: ${result.requestId}\n${result.detail}"
        if (result.isTerminal) openBridgeCallback(result)
    }
    private var lastAppPackageTaskResult: AppPackageTaskResult? = null

    private fun showPairingKey(rotate: Boolean = false) {
        val secret = runCatching { DevicePairingSecretStore.getOrCreateSecretBase64(this, rotate) }.getOrNull()
        if (secret == null) {
            status.text = "নিরাপদ pairing key তৈরি করা যায়নি; Android Keystore পরীক্ষা করুন।"
            return
        }
        android.app.AlertDialog.Builder(this)
            .setTitle("Mosharrof Web pairing key")
            .setMessage("ওয়েব চ্যাটে ‘Android যুক্ত করুন’ লিখে এই কী পেস্ট করুন। কীটি শুধু আপনার ব্রাউজারের লোকাল স্টোরেজে রাখুন; অন্য কাউকে দেবেন না।\n\n$secret")
            .setPositiveButton("কপি করুন") { _, _ ->
                val clipboard = getSystemService(CLIPBOARD_SERVICE) as? ClipboardManager
                clipboard?.setPrimaryClip(ClipData.newPlainText("Mosharrof Android pairing key", secret))
                Toast.makeText(this, "Pairing key কপি হয়েছে।", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("নতুন কী") { _, _ -> showPairingKey(rotate = true) }
            .setNegativeButton("বন্ধ", null)
            .show()
    }

    private fun handleExternalCommand(source: Intent): Boolean {
        val uri = source.data ?: return false
        if (uri.scheme != "mosharrof-agent" || uri.host != "command") return false
        externalCallback = safeBridgeCallback(uri.getQueryParameter("callback"))
        val requestId = uri.getQueryParameter("rid")
            ?.takeIf { it.length in 1..128 && it.all { ch -> ch.isLetterOrDigit() || ch in "-_." } }
            ?: java.util.UUID.randomUUID().toString()
        // If Android recreated the activity while the system installer was open, resume the
        // already-authorized operation instead of rejecting its one-time nonce as a replay.
        if (AppPackagePendingOperationStore.hasPendingRequest(this, requestId)) return true

        val action = runCatching {
            DeviceCommandAction.valueOf(uri.getQueryParameter("action") ?: "")
        }.getOrNull()
        val target = uri.getQueryParameter("target") ?: ""
        val taskAction = when (action) {
            DeviceCommandAction.SEARCH_PLAY_STORE -> AppPackageTaskAction.SEARCH_PLAY_STORE
            DeviceCommandAction.UNINSTALL_APP -> AppPackageTaskAction.UNINSTALL_APP
            else -> AppPackageTaskAction.INSTALL_APK
        }
        val safePackageName = target.takeIf {
            taskAction == AppPackageTaskAction.UNINSTALL_APP &&
                Regex("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+").matches(it)
        }
        val secret = DevicePairingSecretStore.loadSecret(this)
        if (action == null || secret == null) {
            publishAppPackageResult(
                AppPackageTaskResult(
                    requestId, taskAction, AppPackageTaskStatus.FAILED,
                    if (secret == null) "Android Agent-এ আগে pairing key তৈরি করে ওয়েব চ্যাটে সংরক্ষণ করুন।"
                    else "Android command envelope-এর action ভুল; কোনো কাজ চালানো হয়নি।",
                    safePackageName
                )
            )
            return true
        }
        val envelope = DeviceCommandEnvelope(
            requestId = requestId,
            action = action,
            issuedAtMillis = uri.getQueryParameter("issued")?.toLongOrNull() ?: -1L,
            expiresAtMillis = uri.getQueryParameter("expires")?.toLongOrNull() ?: -1L,
            nonce = uri.getQueryParameter("nonce") ?: "",
            target = target,
            signatureHex = uri.getQueryParameter("sig") ?: ""
        )
        val verification = DeviceCommandReplayStore.verifyAndRemember(
            this, deviceCommandAuthenticator, envelope, secret, System.currentTimeMillis()
        )
        if (!verification.accepted) {
            publishAppPackageResult(
                AppPackageTaskResult(
                    requestId, taskAction, AppPackageTaskStatus.FAILED,
                    "নিরাপত্তা যাচাই ব্যর্থ: ${verification.rejection}; কোনো অ্যাপ কমান্ড চালানো হয়নি।",
                    safePackageName
                )
            )
            return true
        }
        when (action) {
            DeviceCommandAction.INSTALL_APK -> {
                pendingExternalRequestId = requestId
                apkPicker.launch(arrayOf("application/vnd.android.package-archive"))
            }
            DeviceCommandAction.SEARCH_PLAY_STORE -> {
                if (target.isBlank()) {
                    publishAppPackageResult(AppPackageTaskResult(requestId, taskAction, AppPackageTaskStatus.FAILED, "অ্যাপের সার্চ নাম খালি; কোনো কাজ চালানো হয়নি।"))
                } else {
                    AppPackageControl.handleCommand(
                        this, "install $target", status,
                        pickApk = { apkPicker.launch(arrayOf("application/vnd.android.package-archive")) },
                        onTaskResult = ::publishAppPackageResult,
                        requestIdOverride = requestId
                    )
                }
            }
            DeviceCommandAction.UNINSTALL_APP -> {
                AppPackageControl.requestUninstall(this, target, status, requestId, ::publishAppPackageResult)
            }
        }
        return true
    }

    private fun safeBridgeCallback(raw: String?): Uri? {
        if (raw.isNullOrBlank()) return null
        val uri = runCatching { Uri.parse(raw) }.getOrNull() ?: return null
        if (uri.scheme != "https" || uri.host != "mosharrof0000-ux.github.io" || uri.path != "/Mosharrof/") return null
        return uri.buildUpon().clearQuery().fragment(null).build()
    }

    private fun openBridgeCallback(result: AppPackageTaskResult) {
        val callback = externalCallback ?: safeBridgeCallback(intent.data?.getQueryParameter("callback")) ?: return
        val secret = DevicePairingSecretStore.loadSecret(this) ?: return
        val callbackDetail = result.detail.take(300)
        val canonicalResult = listOf(
            "mosharrof-device-result-v1",
            result.requestId,
            result.action.name,
            result.status.name,
            result.packageName ?: "",
            result.packageStateVerified.toString(),
            callbackDetail
        ).joinToString("\\n")
        val signature = DeviceCommandAuthenticator.sign(secret, canonicalResult)
        val uri = callback.buildUpon()
            .appendQueryParameter("mosharrof_android_result", "1")
            .appendQueryParameter("request_id", result.requestId)
            .appendQueryParameter("action", result.action.name)
            .appendQueryParameter("status", result.status.name)
            .appendQueryParameter("detail", callbackDetail)
            .appendQueryParameter("verified", result.packageStateVerified.toString())
            .appendQueryParameter("package", result.packageName ?: "")
            .appendQueryParameter("callback_sig", signature)
            .build()
        externalCallback = null
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            .onFailure { status.text = "কাজের ফল সংরক্ষিত হয়েছে, কিন্তু ওয়েব চ্যাটে ফল ফেরত খোলা যায়নি।" }
    }
    private fun startSpeechInput() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "bn-BD")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "অ্যাপ খুলতে বা নিরাপদ UI লেবেলে ট্যাপ করতে বলুন")
        }
        try {
            speechResult.launch(intent)
        } catch (_: Exception) {
            status.text = "এই ডিভাইসে speech recognition অ্যাপ পাওয়া যায়নি।"
        }
    }
    private fun refreshServiceStatus() {
        status.text = when {
            !isServiceEnabled() ->
                "Accessibility বন্ধ। অ্যাপ খোলার কমান্ড চলবে; স্ক্যান ও UI action-এর জন্য Settings-এ চালু করুন।"
            MosharrofAccessibilityService.isInspectionArmed() &&
                MosharrofAccessibilityService.hasInspectionSnapshot() ->
                "স্ক্যানের ফল প্রস্তুত। ফল দেখতে আবার ‘বর্তমান স্ক্রিন পরীক্ষা করুন’ চাপুন।"
            MosharrofAccessibilityService.isInspectionArmed() ->
                "স্ক্যান চলছে। লক্ষ্য অ্যাপ খুলে এখানে ফিরে আসুন।"
            else -> "Accessibility সক্রিয়। কমান্ড যাচাই করে নিশ্চিত করার পর অ্যাপ/Settings খোলা যাবে।"
        }
    }
    override fun onDestroy() {
        ScreenshotAnalysisControl.release()
        speechOutput?.close()
        super.onDestroy()
    }
    private fun isServiceEnabled(): Boolean {
        val manager = getSystemService<AccessibilityManager>() ?: return false
        return manager.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        ).any { it.resolveInfo.serviceInfo.packageName == packageName }
    }
    companion object {
        const val EXTRA_START_VOICE = "com.mosharrof.agent.EXTRA_START_VOICE"
    }
}