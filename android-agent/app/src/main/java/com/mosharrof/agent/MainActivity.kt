package com.mosharrof.agent

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.content.getSystemService

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val title = TextView(this).apply {
            text = "মোশাররফ অটোনোমাস এজেন্ট"
            textSize = 24f
            contentDescription = "Mosharrof Autonomous Agent"
        }
        val status = TextView(this).apply { textSize = 16f }
        val accessibilityButton = Button(this).apply {
            text = "Accessibility অনুমতি সেটিংস খুলুন"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 32)
            addView(title)
            addView(status)
            addView(accessibilityButton)
        }
        setContentView(layout)

        status.text = if (isServiceEnabled()) {
            "Accessibility Service সক্রিয়। এখনো কোনো কাজ স্বয়ংক্রিয়ভাবে শুরু হয়নি।"
        } else {
            "Accessibility Service বন্ধ। চালু করতে Android Settings-এ যান।"
        }
    }

    private fun isServiceEnabled(): Boolean {
        val manager = getSystemService<AccessibilityManager>() ?: return false
        return manager.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        ).any { it.resolveInfo.serviceInfo.packageName == packageName }
    }
}
