package com.mosharrof.agent.notifications

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Explicit UI for granting notification access and reviewing a bounded in-memory snapshot. */
object NotificationAccessControl {
    fun addTo(activity: Activity, layout: LinearLayout) {
        val result = TextView(activity).apply { textSize = 14f }
        layout.addView(Button(activity).apply {
            text = "নোটিফিকেশন পড়ার অনুমতি দিন"
            setOnClickListener {
                runCatching { activity.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
                    .onFailure { result.text = "Notification access settings খোলা যায়নি।" }
            }
        })
        layout.addView(Button(activity).apply {
            text = "সাম্প্রতিক নোটিফিকেশন দেখুন"
            setOnClickListener {
                if (!isAccessEnabled(activity)) {
                    result.text = "প্রথমে Android Settings থেকে MOSHARROF-এর Notification access চালু করুন।"
                    return@setOnClickListener
                }
                val items = AgentNotificationListenerService.snapshot()
                result.text = if (items.isEmpty()) "এখনো কোনো নোটিফিকেশন snapshot পাওয়া যায়নি।" else items.joinToString("\n\n") {
                    "${it.title.ifBlank { it.packageName }}\n${it.text}"
                }
            }
        })
        layout.addView(result, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }

    fun isAccessEnabled(activity: Activity): Boolean {
        val enabled = Settings.Secure.getString(activity.contentResolver, "enabled_notification_listeners").orEmpty()
        return enabled.split(":").any { ComponentName.unflattenFromString(it)?.packageName == activity.packageName }
    }
}
