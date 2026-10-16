package com.mosharrof.agent.notifications

import android.app.Activity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Local notification inbox preview; notification access is enabled only by the device owner. */
object NotificationInboxControl {
    fun addTo(activity: Activity, layout: LinearLayout, status: TextView) {
        val output = TextView(activity).apply { textSize = 14f }
        layout.addView(Button(activity).apply {
            text = "অনুমোদিত নোটিফিকেশন দেখুন"
            setOnClickListener {
                output.text = MosharrofNotificationListenerService.snapshot()
                status.text = "লোকাল নোটিফিকেশন ইনবক্স আপডেট হয়েছে।"
            }
        })
        layout.addView(Button(activity).apply {
            text = "লোকাল নোটিফিকেশন তালিকা মুছুন"
            setOnClickListener {
                MosharrofNotificationListenerService.clearLocalSnapshot()
                output.text = "লোকাল তালিকা মুছে ফেলা হয়েছে।"
                status.text = "MOSHARROF-এর অস্থায়ী নোটিফিকেশন তালিকা মুছে ফেলা হয়েছে।"
            }
        })
        layout.addView(output)
    }
}
