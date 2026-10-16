package com.mosharrof.agent

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.content.getSystemService
import com.mosharrof.agent.planner.AgentIntent
import com.mosharrof.agent.planner.DispatchResult
import com.mosharrof.agent.planner.IntentDispatcher
import com.mosharrof.agent.planner.VoiceCommandParser

class MainActivity : ComponentActivity() {
    private val parser = VoiceCommandParser()
    private lateinit var commandInput: EditText
    private lateinit var result: TextView
    private var pendingIntent: AgentIntent? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val title = TextView(this).apply { text = "মোশাররফ অটোনোমাস এজেন্ট"; textSize = 24f }
        val status = TextView(this).apply { textSize = 15f; text = serviceStatus() }
        commandInput = EditText(this).apply { hint = "বলুন বা লিখুন: সেটিংস খোলো"; minLines = 2 }
        result = TextView(this).apply { textSize = 16f }
        val previewButton = Button(this).apply {
            text = "কমান্ড বুঝুন"
            setOnClickListener { previewCommand() }
        }
        val executeButton = Button(this).apply {
            text = "আমি নিশ্চিত — কাজটি করুন"
            setOnClickListener { executePending() }
        }
        val accessibilityButton = Button(this).apply {
            text = "Accessibility সেটিংস খুলুন"
            setOnClickListener { startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }
        }
        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 40, 32, 32)
            addView(title); addView(status); addView(commandInput)
            addView(previewButton); addView(result); addView(executeButton)
            addView(accessibilityButton)
        })
    }

    private fun previewCommand() {
        pendingIntent = parser.parse(commandInput.text.toString())
        result.text = when (val intent = pendingIntent) {
            is AgentIntent.OpenApp -> "কাজের প্রস্তাব: ${intent.appKey} খুলুন। নিশ্চিত করলে তবেই চলবে।"
            is AgentIntent.SearchWeb -> "ওয়েবে খুঁজুন: ${intent.query}। নিশ্চিত করলে তবেই চলবে।"
            AgentIntent.InspectCurrentScreen -> "স্ক্রিন পরিদর্শন এখনও চালু নয়।"
            is AgentIntent.Unknown -> "কাজ করা যাচ্ছে না: ${intent.reason}"
            null -> "আগে একটি কমান্ড লিখুন।"
        }
    }

    private fun executePending() {
        val intent = pendingIntent ?: run {
            result.text = "আগে কমান্ড বুঝুন, তারপর নিশ্চিত করুন."
            return
        }
        if (intent is AgentIntent.Unknown || intent is AgentIntent.InspectCurrentScreen) {
            result.text = "এই কমান্ডটি এখন সমর্থিত নয়।"
            return
        }
        result.text = when (val outcome = IntentDispatcher(this).dispatch(intent)) {
            DispatchResult.Started -> "Android-এ কাজটি খোলার অনুরোধ পাঠানো হয়েছে।"
            is DispatchResult.NotSupported -> outcome.message
            is DispatchResult.Failed -> outcome.message
        }
        pendingIntent = null
    }

    private fun serviceStatus(): String {
        val manager = getSystemService<AccessibilityManager>()
            ?: return "সার্ভিস স্ট্যাটাস পাওয়া যায়নি।"
        val enabled = manager.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        ).any { it.resolveInfo.serviceInfo.packageName == packageName }
        return if (enabled) "Accessibility Service সক্রিয়."
        else "Accessibility Service বন্ধ। সেটিংস থেকে নিজে চালু করুন।"
    }
}
