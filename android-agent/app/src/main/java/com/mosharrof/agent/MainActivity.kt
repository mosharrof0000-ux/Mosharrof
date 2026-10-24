package com.mosharrof.agent
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Bundle
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
import com.mosharrof.agent.execution.AppPackageTaskAction
import com.mosharrof.agent.execution.AppPackageTaskResult
import com.mosharrof.agent.execution.AppPackageTaskResultStore
import com.mosharrof.agent.execution.AppPackageTaskStatus
import com.mosharrof.agent.execution.DeviceIntentControl
import com.mosharrof.agent.execution.TaskControlButtons
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
    private lateinit var commandInput: EditText
    private lateinit var confirmButton: Button
    private var speechOutput: AgentSpeechOutput? = null
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
            setOnClickListener { inspectCurrentScreen() }
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
    }

    private var lastAppPackageTaskResult: AppPackageTaskResult? = null

    private fun inspectCurrentScreen() {
        if (!isServiceEnabled()) {
            status.text = "স্ক্রিন পরীক্ষা করতে আগে Accessibility service চালু করুন।"
            screenDetails.text = ""
            return
        }
        val snapshot = MosharrofAccessibilityService.takeInspectionSnapshot()
        if (snapshot == null) {
            MosharrofAccessibilityService.startInspection()
            status.text = "স্ক্যান প্রস্তুত। যে অ্যাপ পরীক্ষা করতে চান সেটি খুলুন, তারপর এখানে ফিরে আবার স্ক্রিন পরীক্ষা চাপুন।"
            screenDetails.text = ""
            return
        }
        status.text = "স্ক্যান সম্পন্ন: ${snapshot.packageName} • ${snapshot.nodeCount}টি UI node"
        screenDetails.text = snapshot.visibleLabels.joinToString("\n").ifBlank {
            "এই স্ক্রিনে পড়ার মতো কোনো দৃশ্যমান লেবেল পাওয়া যায়নি।"
        }
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
