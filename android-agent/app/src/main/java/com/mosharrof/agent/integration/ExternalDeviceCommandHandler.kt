package com.mosharrof.agent.integration

import android.app.Activity
import android.content.Intent
import android.widget.EditText
import android.widget.TextView

/** Validates bounded handoffs from MOSHARROF chat; local planning/confirmation remains mandatory. */
object ExternalDeviceCommandHandler {
    fun handle(
        activity: Activity,
        source: Intent,
        commandInput: EditText,
        status: TextView,
        prepareCommand: (String) -> Unit
    ) {
        val uri = source.data ?: return
        if (uri.scheme != "mosharrof" || uri.host != "device-control") return
        val command = uri.getQueryParameter("command")?.trim().orEmpty()
        if (command.isBlank() || command.length > 240 || command.any { it.isISOControl() }) {
            status.text = "MOSHARROF থেকে আসা নির্দেশটি খালি বা সীমার বাইরে; কোনো কাজ চালানো হয়নি।"
            return
        }
        activity.window.decorView.post {
            if (activity.isFinishing) return@post
            commandInput.setText(command)
            status.text = "MOSHARROF চ্যাট থেকে নির্দেশ এসেছে। চালানোর আগে নিচের প্রস্তাব যাচাই ও নিশ্চিত করুন।"
            prepareCommand(command)
        }
    }
}
