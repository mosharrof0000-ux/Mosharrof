package com.mosharrof.agent.execution

import android.app.Activity
import android.widget.Button
import android.widget.LinearLayout

/** Explicit, always-visible cancel control for a pending task preview. */
object TaskControlButtons {
    fun addCancelButton(activity: Activity, layout: LinearLayout, cancel: () -> Unit) {
        layout.addView(Button(activity).apply {
            text = "কাজ বাতিল করুন"
            setOnClickListener { cancel() }
        })
    }
}
