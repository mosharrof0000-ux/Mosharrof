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
import com.mosharrof.agent.execution.InstalledAppCatalog
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.InstalledApp
import com.mosharrof.agent.planner.TaskPlan
import com.mosharrof.agent.planner.TaskPlanner
import com.mosharrof.agent.policy.ActionPolicy
import com.mosharrof.agent.policy.PolicyDecision

class MainActivity : ComponentActivity() {
    private val planner = TaskPlanner()
    private val appCatalog by lazy { InstalledAppCatalog(this) }
    private var pendingApp: InstalledApp? = null
    private lateinit var status: TextView
    private lateinit var screenDetails: TextView
    private lateinit var commandInput: EditText
    private lateinit var confirmButton: Button

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
        screenDetails = TextView(this).apply { textSize = 14f }
        commandInput = EditText(this).apply {
            hint = "যেমন: Open YouTube / ইউটিউব খুলুন"
            singleLine = true
        }
        confirmButton = Button(this).apply {
            text = "নিশ্চিত করে অ্যাপ খুলুন"
            isEnabled = false
            setOnClickListener { launchConfirmedApp() }
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
            setOnClickListener { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
        }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 32)
            addView(title)
            addView(status)
            addView(commandInput)
            addView(voiceButton)
            addView(planButton)
            addView(confirmButton)
            addView(inspectButton)
            addView(screenDetails)
            addView(accessibilityButton)
        })
        refreshServiceStatus()
    }

    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) refreshServiceStatus()
    }

    private fun prepareTask(command: String) {
        pendingApp = null
        confirmButton.isEnabled = false
        when (val plan = planner.plan(command, installedApps())) {
            is TaskPlan.OpenApp -> {
                pendingApp = plan.app
                status.text = "পরিকল্পনা: ${plan.app.label} খুলবে। চালানোর আগে নিশ্চিত করুন।"
                confirmButton.isEnabled = true
            }
            is TaskPlan.NeedsChoice -> status.text =
                "একাধিক/আংশিক মিল: ${plan.candidates.joinToString { it.label }}। সঠিক অ্যাপের পুরো নাম লিখুন।"
            is TaskPlan.Rejected -> status.text = "কমান্ড চালানো হয়নি: ${plan.reason}"
        }
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
        val snapshot = MosharrofAccessibilityService.inspectActiveWindow()
        if (snapshot == null) {
            status.text = "স্ক্রিন পরীক্ষা করতে Accessibility service চালু করুন এবং আবার চেষ্টা করুন।"
            screenDetails.text = ""
            return
        }
        status.text = "স্ক্রিন পরীক্ষা সম্পন্ন: ${snapshot.packageName} • ${snapshot.nodeCount}টি UI node"
        screenDetails.text = snapshot.visibleLabels.joinToString("\n").ifBlank {
            "এই স্ক্রিনে পড়ার মতো কোনো দৃশ্যমান লেবেল পাওয়া যায়নি।"
        }
    }

    private fun installedApps(): List<InstalledApp> = appCatalog.listLauncherApps()

    private fun startSpeechInput() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "bn-BD")
            putExtra(RecognizerIntent.EXTRA_PROMPT, "কী অ্যাপ খুলতে চান বলুন")
        }
        try {
            speechResult.launch(intent)
        } catch (_: Exception) {
            status.text = "এই ডিভাইসে speech recognition অ্যাপ পাওয়া যায়নি।"
        }
    }

    private fun refreshServiceStatus() {
        status.text = if (isServiceEnabled()) {
            "Accessibility সক্রিয়। কমান্ড যাচাই করে নিশ্চিত করার পর অ্যাপ খোলা যাবে।"
        } else {
            "Accessibility বন্ধ। অ্যাপ খোলার কমান্ড চলবে; UI পরিদর্শনের জন্য Settings-এ চালু করুন।"
        }
    }

    private fun isServiceEnabled(): Boolean {
        val manager = getSystemService<AccessibilityManager>() ?: return false
        return manager.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        ).any { it.resolveInfo.serviceInfo.packageName == packageName }
    }
}
