package com.mosharrof.agent.diagnostics

import android.app.Activity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Adds an explicit user-triggered diagnostics action and local result display. */
object DeviceDiagnosticsControl {
    fun addTo(activity: Activity, layout: LinearLayout) {
        val result = TextView(activity).apply { textSize = 14f }
        layout.addView(Button(activity).apply {
            text = "ডিভাইসের অবস্থা পরীক্ষা করুন"
            setOnClickListener { result.text = DeviceDiagnostics(activity).snapshot() }
        })
        layout.addView(result)
    }
}
