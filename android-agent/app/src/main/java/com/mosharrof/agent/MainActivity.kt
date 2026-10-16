package com.mosharrof.agent
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognizerIntent
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.getSystemService
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService
import com.mosharrof.agent.accessibility.FloatingControlToggle
import com.mosharrof.agent.accessibility.ScreenshotAnalysisControl
import com.mosharrof.agent.permissions.DeviceCapabilityCenter
import com.mosharrof.agent.diagnostics.DeviceDiagnosticsControl
import com.mosharrof.agent.execution.AccessibilityConsentDialog
import com.mosharrof.agent.execution.AgentTaskController
import com.mosharrof.agent.execution.TaskControlButtons
import com.mosharrof.agent.voice.AgentSpeechOutput
import com.mosharrof.agent.voice.SpeechOutputControls
import com.mosharrof.agent.permissions.CapabilityPermissionCenter
import com.mosharrof.agent.notifications.NotificationAccessControl
import com.mosharrof.agent.permissions.PermissionCenterControl
import com.mosharrof.agent.notifications.NotificationInboxControl
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
        status.text = "অনুমতি ফলাফল: $grantedটি অনুমোদিত, $deniedটি অননুমোদিত। বিশেষ অনুমতিগুলো নিচের Settings বোতাম থেকে চালু করুন।"
    }
    private val speechResult = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()?.takeIf { it.isNotBlank() }?.let {
                commandInput.setText(it)
                taskController.prepareTask(it)
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
            setOnClickListener { taskController.prepareTask(commandInput.text.toString()) }
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
        setContentView(LinearLayout(this).apply {
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
            FloatingControlToggle.addTo(this@MainActivity, this, status)
            TaskControlButtons.addCancelButton(this@MainActivity, this) { taskController.cancelPending() }
            addView(inspectButton)
            ScreenshotAnalysisControl.addTo(this@MainActivity, this, status, ::isServiceEnabled)
            addView(screenDetails)
            DeviceDiagnosticsControl.addTo(this@MainActivity, this)
            DeviceCapabilityCenter.addTo(this@MainActivity, this, status)
            NotificationInboxControl.addTo(this@MainActivity, this, status)
            PermissionCenterControl.addTo(this@MainActivity, this, status) {
                permissionResult.launch(PermissionCenterControl.runtimePermissions)
            }
            addView(accessibilityButton)
            addCapabilitySettings(this)
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
    override fun onDestroy() { speechOutput?.close(); speechOutput = null; super.onDestroy() }
    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) {
            val actionResult = MosharrofAccessibilityService.takeActionResult()
            if (actionResult != null) status.text = actionResult else refreshServiceStatus()
        }
    }
    private fun addCapabilitySettings(layout: LinearLayout) {
        layout.addView(TextView(this).apply { text = "পূর্ণ ডিভাইস সক্ষমতা — Android অনুমতি"; textSize = 20f })
        val routes = listOf(
            "Accessibility: স্ক্রিন বোঝা ও UI নিয়ন্ত্রণ" to (Settings.ACTION_ACCESSIBILITY_SETTINGS to null),
            "ভাসমান নিয়ন্ত্রণের অনুমতি" to (Settings.ACTION_MANAGE_OVERLAY_PERMISSION to ("package:" + packageName)),
            "সব ফাইল অ্যাক্সেস" to (Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION to ("package:" + packageName)),
            "অ্যাপ ব্যবহার-ইতিহাস অ্যাক্সেস" to (Settings.ACTION_USAGE_ACCESS_SETTINGS to null),
            "ব্যাটারি অপ্টিমাইজেশন সেটিংস" to (Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS to null),
            "MOSHARROF অ্যাপ অনুমতি" to (Settings.ACTION_APPLICATION_DETAILS_SETTINGS to ("package:" + packageName))
        )
        routes.forEach { (label, route) ->
            layout.addView(Button(this).apply {
                text = label
                setOnClickListener {
                    val target = Intent(route.first)
                    route.second?.let { target.data = Uri.parse(it) }
                    try { startActivity(target) } catch (_: Exception) { startActivity(Intent(Settings.ACTION_SETTINGS)) }
                }
            })
        }
        status.append("\\nOverlay: " + Settings.canDrawOverlays(this) +
            " • All files: " + (Build.VERSION.SDK_INT < 30 || Environment.isExternalStorageManager()))
    }
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
