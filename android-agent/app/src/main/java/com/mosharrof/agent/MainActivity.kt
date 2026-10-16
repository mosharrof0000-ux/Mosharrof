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
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.getSystemService
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService
import com.mosharrof.agent.execution.AccessibilityConsentDialog
import com.mosharrof.agent.execution.InstalledAppCatalog
import com.mosharrof.agent.execution.SystemSettingsLauncher
import com.mosharrof.agent.execution.TaskControlButtons
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.InstalledApp
import com.mosharrof.agent.planner.TaskPlan
import com.mosharrof.agent.planner.TaskPlanner
import com.mosharrof.agent.policy.ActionPolicy
import com.mosharrof.agent.policy.PolicyDecision
import com.mosharrof.agent.voice.AgentSpeechOutput
import com.mosharrof.agent.voice.SpeechOutputControls
class MainActivity : ComponentActivity() {
    private val planner = TaskPlanner()
    private val appCatalog by lazy { InstalledAppCatalog(this) }
    private val settingsLauncher by lazy { SystemSettingsLauncher(this) }
    private var pendingApp: InstalledApp? = null
    private var pendingSettings: TaskPlan? = null
    private var pendingTap: TaskPlan.TapVisibleText? = null
    private lateinit var status: TextView
    private lateinit var speechStatus: TextView
    private lateinit var screenDetails: TextView
    private lateinit var commandInput: EditText
    private lateinit var confirmButton: Button
    private var speechOutput: AgentSpeechOutput? = null
    private val speechResult = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            ?.firstOrNull()?.takeIf { it.isNotBlank() }?.let {
                commandInput.setText(it)
                prepareTask(it)
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
            setOnClickListener {
                when {
                    pendingApp != null -> launchConfirmedApp()
                    pendingSettings != null -> launchConfirmedSettings()
                    pendingTap != null -> launchConfirmedTap()
                }
            }
        }
        val planButton = Button(this).apply {
            text = "কমান্ড যাচাই করুন"
            setOnClickListener { prepareTask(commandInput.text.toString()) }
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
            TaskControlButtons.addCancelButton(this@MainActivity, this) { pendingApp = null; pendingSettings = null; pendingTap = null; MosharrofAccessibilityService.cancelSemanticTap(); MosharrofAccessibilityService.cancelInspection(); confirmButton.isEnabled = false; status.text = "অপেক্ষমাণ কাজ বাতিল হয়েছে।" }
            addView(inspectButton)
            addView(screenDetails)
            addView(accessibilityButton)
        })
        refreshServiceStatus()
    }
    override fun onDestroy() { speechOutput?.close(); speechOutput = null; super.onDestroy() }
    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) {
            val actionResult = MosharrofAccessibilityService.takeActionResult()
            if (actionResult != null) status.text = actionResult else refreshServiceStatus()
        }
    }
    private fun prepareTask(command: String) {
        pendingApp = null
        pendingSettings = null
        pendingTap = null
        confirmButton.isEnabled = false
        when (val plan = planner.plan(command, installedApps())) {
            is TaskPlan.OpenApp -> {
                pendingApp = plan.app
                status.text = "পরিকল্পনা: ${plan.app.label} খুলবে। চালানোর আগে নিশ্চিত করুন।"
                confirmButton.isEnabled = true
            }
            is TaskPlan.TapVisibleText -> {
                pendingTap = plan
                status.text = if (isServiceEnabled()) {
                    "পরিকল্পনা: ${plan.app.label}-এ ‘${plan.text}’ লেবেলে একবার ট্যাপ হবে। নিশ্চিত করুন।"
                } else {
                    "এই UI action-এর জন্য আগে Accessibility চালু করুন।"
                }
                confirmButton.isEnabled = isServiceEnabled()
            }
            TaskPlan.OpenSystemSettings -> prepareSettings(plan, "Android Settings")
            is TaskPlan.OpenSettingPanel -> prepareSettings(plan, settingsLauncher.label(plan.setting))
            is TaskPlan.NeedsChoice -> status.text =
                "একাধিক/আংশিক মিল: ${plan.candidates.joinToString { it.label }}। সঠিক অ্যাপের পুরো নাম লিখুন।"
            is TaskPlan.Rejected -> status.text = "কমান্ড চালানো হয়নি: ${plan.reason}"
        }
    }
    private fun prepareSettings(plan: TaskPlan, label: String) { pendingSettings = plan; status.text = "পরিকল্পনা: ${label} খোলা হবে। চালানোর আগে নিশ্চিত করুন।"; confirmButton.isEnabled = true }
    private fun launchConfirmedSettings() {
        val plan = pendingSettings ?: return
        status.text = settingsLauncher.launch(plan)
        pendingSettings = null
        confirmButton.isEnabled = false
    }
    private fun launchConfirmedTap() {
        val plan = pendingTap ?: return
        if (!isServiceEnabled()) {
            status.text = "Accessibility বন্ধ; কোনো ট্যাপ করা হয়নি।"
            return
        }
        val allowed = installedApps().map { it.packageName }.toSet()
        val decision = ActionPolicy(allowed).evaluate(
            AgentAction.TapSemanticNode(plan.app.packageName, visibleText = plan.text), 0
        )
        if (decision.decision == PolicyDecision.DENY) {
            status.text = "নিরাপত্তা নীতিতে বাধা: ${decision.reason}"
            return
        }
        if (!MosharrofAccessibilityService.armSemanticTap(plan.app.packageName, plan.text)) {
            status.text = "Accessibility service প্রস্তুত নয় বা অন্য action চলছে; কোনো ট্যাপ করা হয়নি।"
            return
        }
        if (!appCatalog.launch(plan.app.packageName)) {
            MosharrofAccessibilityService.cancelSemanticTap()
            status.text = "লক্ষ্য অ্যাপ খোলা যায়নি; কোনো ট্যাপ করা হয়নি।"
            return
        }
        status.text = "লক্ষ্য অ্যাপ খুলছে। নির্দিষ্ট লেবেল একবারই মিললে ট্যাপ হবে; অস্পষ্ট হলে বাতিল হবে।"
        pendingTap = null
        confirmButton.isEnabled = false
    }
    private fun launchConfirmedApp() {
        val app = pendingApp ?: return
        val allowed = installedApps().map { it.packageName }.toSet()
        val decision = ActionPolicy(allowed).evaluate(
            AgentAction.OpenApp(app.packageName, userRequested = true), 0
        )
        if (decision.decision != PolicyDecision.ALLOW) {
            status.text = "নিরাপত্তা নীতিতে বাধা: ${decision.reason}"
            return
        }
        if (!appCatalog.launch(app.packageName)) {
            status.text = "অ্যাপটি খোলা যায়নি; অ্যাপটি সরানো বা নিষ্ক্রিয় থাকতে পারে।"
            return
        }
        status.text = "${app.label} খোলার অনুরোধ পাঠানো হয়েছে।"
        pendingApp = null
        confirmButton.isEnabled = false
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
    private fun installedApps() = appCatalog.listLauncherApps()
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
}
