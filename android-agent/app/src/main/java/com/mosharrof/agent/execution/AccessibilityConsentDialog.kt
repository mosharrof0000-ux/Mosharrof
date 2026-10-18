package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Context

/**
 * Shows an in-app disclosure before asking the user to enable Accessibility.
 * The Android system setting is opened only after affirmative consent.
 */
object AccessibilityConsentDialog {
    private const val PREFS = "mosharrof_privacy"
    private const val KEY_CONSENTED = "accessibility_disclosure_consented"

    fun show(activity: Activity, onAccepted: () -> Unit): AlertDialog? {
        if (activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_CONSENTED, false)) {
            onAccepted()
            return null
        }

        val dialog = AlertDialog.Builder(activity)
            .setTitle("স্ক্রিন নিয়ন্ত্রণের অনুমতি")
            .setMessage(
                "MOSHARROF AI স্ক্রিনে দৃশ্যমান লেখা ও বোতামের তথ্য পড়তে পারে, " +
                    "যাতে আপনি নির্দেশ দিলে নির্দিষ্ট অ্যাপের স্ক্রিন পরীক্ষা বা অনুমোদিত কাজ করতে পারে। " +
                    "এই সংস্করণে স্ক্রিনের তথ্য স্বয়ংক্রিয়ভাবে সার্ভারে পাঠানো হয় না। " +
                    "Accessibility চালু করলে এই ক্ষমতা সক্রিয় হবে; আপনি Android Settings থেকে যেকোনো সময় বন্ধ করতে পারবেন। " +
                    "সংবেদনশীল কাজের জন্য আলাদা নিশ্চিতকরণ আবশ্যক।"
            )
            .setNegativeButton("এখন নয়", null)
            .setPositiveButton("বুঝেছি, Settings খুলুন") { _, _ ->
                activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(KEY_CONSENTED, true).apply()
                onAccepted()
            }
            .setOnCancelListener { }
            .create()
        dialog.show()
        return dialog
    }
}
