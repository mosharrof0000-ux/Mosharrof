package com.mosharrof.agent.accessibility

import android.app.Activity
import android.widget.TextView

/** One-shot, user-triggered screen snapshot display. */
object CurrentScreenInspectionControl {
    fun inspect(
        activity: Activity,
        status: TextView,
        screenDetails: TextView,
        isServiceEnabled: () -> Boolean
    ) {
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
