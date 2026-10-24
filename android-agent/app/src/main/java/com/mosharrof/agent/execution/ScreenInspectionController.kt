package com.mosharrof.agent.execution

import android.content.Context
import android.widget.TextView
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService

/**
 * Keeps screen-inspection UI flow outside MainActivity so each Android UI organ
 * stays small and independently testable.
 */
class ScreenInspectionController(
    private val context: Context,
    private val status: TextView,
    private val screenDetails: TextView,
    private val isServiceEnabled: () -> Boolean
) {
    fun inspect() {
        if (!isServiceEnabled()) {
            status.text = "স্ক্রিন পরীক্ষা করতে আগে Accessibility service চালু করুন।"
            screenDetails.text = ""
            return
        }
        val snapshot = MosharrofAccessibilityService.takeInspectionSnapshot()
        if (snapshot == null) {
            MosharrofAccessibilityService.startInspection()
            status.text = "স্ক্যান প্রস্তুত। যে অ্যাপ পরীক্ষা করতে চান সেটি খুলুন, তারপর এখানে ফিরে আবার স্ক্রিন পরীক্ষা চাপুন।"
            screenDetails.text = ""
            return
        }
        status.text = "স্ক্যান সম্পন্ন: ${snapshot.packageName} • ${snapshot.nodeCount}টি UI node"
        screenDetails.text = snapshot.visibleLabels.joinToString("\n").ifBlank {
            "এই স্ক্রিনে পড়ার মতো কোনো দৃশ্যমান লেবেল পাওয়া যায়নি।"
        }
    }
}
