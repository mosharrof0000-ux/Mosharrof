package com.mosharrof.agent
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.app.AlertDialog
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.RecognizerIntent
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.getSystemService
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService
import com.mosharrof.agent.accessibility.ScreenshotAnalysisControl
import com.mosharrof.agent.diagnostics.DeviceDiagnosticsControl
import com.mosharrof.agent.execution.AccessibilityConsentDialog
import com.mosharrof.agent.execution.AgentTaskController
import com.mosharrof.agent.execution.AppPackageControl
import com.mosharrof.agent.execution.AppPackageInstallControl
import com.mosharrof.agent.execution.AppPackagePendingOperationStore
import com.mosharrof.agent.execution.AppPackageTaskAction
import com.mosharrof.agent.execution.AppPackageTaskResult
import com.mosharrof.agent.execution.AppPackageTaskResultStore
import com.mosharrof.agent.execution.AppPackageTaskStatus
import com.mosharrof.agent.execution.DeviceIntentControl
import com.mosharrof.agent.execution.DeviceCommandAction
import com.mosharrof.agent.execution.DeviceCommandEnvelope
import com.mosharrof.agent.execution.DevicePairingBridge
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
    private val devicePollHandler = Handler(Looper.getMainLooper())
    private var devicePolling = false
    private var devicePollInFlight = false
    private var dispatchingRemoteCommand = false
    private val devicePollTask: Runnable = object : Runnable {
        override fun run() {
            if (!devicePolling || devicePollInFlight) return
            devicePollInFlight = true
            Thread {
                val outcome = DevicePairingBridge.poll(this@MainActivity)
                DevicePairingBridge.flushPendingResult(this@MainActivity)
                runOnUiThread {
                    devicePollInFlight = false
                    if (!devicePolling || isFinishing) return@runOnUiThread
                    when (outcome?.paired) {
                        true -> speechStatus.text = "ফোন সংযোগ: paired · foreground নিরাপদ কমান্ড পরীক্ষা চলছে"
                        false -> speechStatus.text = "ফোন সংযোগ: pairing code তৈরি; ব্রাউজারে অনুমোদনের অপেক্ষায়"
                        null -> Unit
                    }
                    outcome?.rejected?.let { rejected: DeviceCommandEnvelope -> handleRejectedRemoteCommand(rejected) }
                    outcome?.command?.let { command: DeviceCommandEnvelope -> handleRemoteCommand(command) }
                    devicePollHandler.postDelayed(devicePollTask, 5_000L)
                }
            }.start()
        }
    }
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
        if (uri != null) AppPackageControl.requestInstallFromSelectedUri(this, uri, status, ::publishAppPackageResult)
        else publishAppPackageResult(
            AppPackageTaskResult(
                requestId = java.util.UUID.randomUUID().toString(),
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
        screenInspectionController = ScreenInspectionController(status, screenDetails, ::isServiceEnabled)
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
            AppPackageInstallControl.addInstallButton(this@MainActivity, this) {
                apkPicker.launch(arrayOf("application/vnd.android.package-archive"))
            }
            addView(Button(this@MainActivity).apply {
                text = "MOSHARROF AI-এর সঙ্গে ফোন যুক্ত করুন"
                setOnClickListener { startDevicePairing() }
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
        if (intent.getBooleanExtra(EXTRA_START_VOICE, false)) {
            intent.removeExtra(EXTRA_START_VOICE)
            window.decorView.post { startSpeechInput() }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_START_VOICE, false)) {
            intent.removeExtra(EXTRA_START_VOICE)
            window.decorView.post { startSpeechInput() }
        }
    }
    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) {
            val packageResult = AppPackagePendingOperationStore.resolveAfterReturn(this)
            if (packageResult != null) publishAppPackageResult(packageResult)
            else {
                val actionResult = MosharrofAccessibilityService.takeActionResult()
                if (actionResult != null) status.text = actionResult else refreshServiceStatus()
            }
            startDevicePolling()
        }
    }
    override fun onPause() {
        stopDevicePolling()
        super.onPause()
    }
    private fun prepareCommand(command: String) {
        if (DevicePairingBridge.pendingRemote(this) != null && !dispatchingRemoteCommand) {
            status.text = "একটি দূরবর্তী Android কাজ এখনো নিশ্চিত/যাচাই হচ্ছে। সেটি শেষ বা বাতিল না হওয়া পর্যন্ত নতুন কমান্ড বন্ধ রাখা হয়েছে।"
            return
        }
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
        AppPackageTaskResultStore.save(this, result)
        status.text = "কাজের ফল: ${result.status} • ID: ${result.requestId}\n${result.detail}"
        DevicePairingBridge.recordRemoteResult(this, result)
    }

    private fun startDevicePairing() {
        status.text = "নিরাপদ pairing শুরু হচ্ছে…"
        Thread {
            val result = runCatching { DevicePairingBridge.startPairing(this@MainActivity) }
            runOnUiThread {
                result.onSuccess { pairing ->
                    if (pairing.alreadyPaired) {
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("MOSHARROF AI যুক্ত আছে")
                            .setMessage("এই ডিভাইস ইতিমধ্যে যুক্ত। ব্রাউজারের Android সংযোগ প্যানেল থেকে pairing বাতিল না করে নতুন কোড তৈরি হবে না।")
                            .setPositiveButton("ঠিক আছে", null).show()
                        startDevicePolling()
                    } else {
                        AlertDialog.Builder(this@MainActivity)
                            .setTitle("ফোন যুক্ত করার কোড")
                            .setMessage("কোড: ${pairing.pairingCode}\n\nএই কোড ৫ মিনিটের মধ্যে MOSHARROF ওয়েবসাইটের ডান মেনু → Android ফোন যুক্ত করুন-এ লিখুন। কোডটি চ্যাটে পাঠাবেন না। সংযোগ হলে শুধু অনুমোদিত কমান্ড এই অ্যাপের সামনে থাকাকালে পরীক্ষা হবে।")
                            .setPositiveButton("ঠিক আছে") { _, _ -> startDevicePolling() }
                            .show()
                        status.text = "Pairing code তৈরি হয়েছে; ওয়েবসাইটে অনুমোদনের অপেক্ষায়।"
                        startDevicePolling()
                    }
                }.onFailure { error ->
                    status.text = "ফোন যুক্ত করা যায়নি: ${error.message ?: "নেটওয়ার্ক/সার্ভার সমস্যা"}। ওয়েব pairing আগে থেকেই থাকলে ব্রাউজার থেকে Disconnect করে আবার চেষ্টা করুন।"
                }
            }
        }.start()
    }

    private fun startDevicePolling() {
        if (devicePolling || !DevicePairingBridge.hasCredentials(this)) return
        devicePolling = true
        devicePollHandler.removeCallbacks(devicePollTask)
        devicePollHandler.post(devicePollTask)
    }

    private fun stopDevicePolling() {
        devicePolling = false
        devicePollHandler.removeCallbacks(devicePollTask)
    }

    private fun handleRemoteCommand(envelope: DeviceCommandEnvelope) {
        if (DevicePairingBridge.pendingRemote(this) != null) {
            Thread { DevicePairingBridge.flushPendingResult(applicationContext) }.start()
            return
        }
        if (!DevicePairingBridge.savePendingRemote(this, envelope)) {
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
        AppPackageTaskResultStore.save(this, received)
        DevicePairingBridge.recordRemoteResult(this, received)
        val command = when (envelope.action) {
            DeviceCommandAction.INSTALL_APK -> "install apk"
            DeviceCommandAction.SEARCH_PLAY_STORE -> "install ${envelope.target}"
            DeviceCommandAction.UNINSTALL_APP -> "uninstall ${envelope.target}"
        }
        dispatchingRemoteCommand = true
        try {
            commandInput.setText(command)
            prepareCommand(command)
        } finally {
            dispatchingRemoteCommand = false
        }
    }

    private fun handleRejectedRemoteCommand(envelope: DeviceCommandEnvelope) {
        if (!DevicePairingBridge.savePendingRemote(this, envelope)) {
            status.text = "স্বাক্ষর যাচাই ব্যর্থ; পুরোনো কাজের ফল সিঙ্ক না হওয়ায় নতুন কমান্ড উপেক্ষা করা হয়েছে।"
            return
        }
        publishAppPackageResult(
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
    private fun refreshServiceStatus() = screenInspectionController.refreshServiceStatus()
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