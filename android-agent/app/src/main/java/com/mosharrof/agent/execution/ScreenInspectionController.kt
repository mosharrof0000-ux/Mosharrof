package com.mosharrof.agent.execution

import android.widget.TextView
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService

/**
 * Keeps screen-inspection UI flow outside MainActivity so each Android UI organ
 * stays small and independently testable.
 */
class ScreenInspectionController(
    private val status: TextView,
    private val screenDetails: TextView,
    private val isServiceEnabled: () -> Boolean
) {
    fun refreshServiceStatus() {
        status.text = when {
            !isServiceEnabled() -> "Accessibility বন্ধ। অ্যাপ খোলার কমান্ড চলবে; স্ক্যান ও UI action-এর জন্য Settings-এ চালু করুন।"
            MosharrofAccessibilityService.isInspectionArmed() && MosharrofAccessibilityService.hasInspectionSnapshot() ->
                "স্ক্যানের ফল প্রস্তুত। ফল দেখতে আবার ‘বর্তমান স্ক্রিন পরীক্ষা করুন’ চাপুন।"
            MosharrofAccessibilityService.isInspectionArmed() -> "স্ক্যান চলছে। লক্ষ্য অ্যাপ খুলে এখানে ফিরে আসুন।"
            else -> "Accessibility সক্রিয়। কমান্ড যাচাই করে নিশ্চিত করার পর অ্যাপ/Settings খোলা যাবে।"
        }
    }

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
