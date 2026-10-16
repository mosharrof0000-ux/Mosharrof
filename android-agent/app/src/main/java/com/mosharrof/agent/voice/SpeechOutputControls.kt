package com.mosharrof.agent.voice

import android.app.Activity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Keeps the main activity small while exposing explicit speak/stop controls. */
object SpeechOutputControls {
    fun addTo(activity: Activity, layout: LinearLayout, output: AgentSpeechOutput?, status: TextView) {
        layout.addView(Button(activity).apply {
            text = "ফলাফল পড়ে শোনান"
            setOnClickListener { output?.speak(status.text.toString()) }
        })
        layout.addView(Button(activity).apply {
            text = "কণ্ঠ থামান"
            setOnClickListener { output?.stop() }
        })
    }
}
