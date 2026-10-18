package com.mosharrof.agent.accessibility
import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.mosharrof.agent.planner.AgentAction
private data class PendingSemanticTap(
    val targetPackage: String,
    val visibleText: String,
    var targetEventsRemaining: Int = 20
)
private data class PendingSwipe(val targetPackage: String, val direction: AgentAction.Direction, var targetEventsRemaining: Int = 20)
/** Bounded screen inspection and exact-label taps run only after explicit user action. */
class MosharrofAccessibilityService : AccessibilityService() {
    override fun onServiceConnected() {
        super.onServiceConnected()
        activeService = this
    }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val eventPackage = event.packageName?.toString().orEmpty()
        latestForegroundPackage = eventPackage
        FocusedTextEntry.onWindowChanged(this, eventPackage, packageName)?.let { latestActionResult = it }
        if (eventPackage == packageName) return
        if (screenshotCaptureArmed && event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED &&
            AccessibilityScreenshotCapture.isTargetPackage(eventPackage)) {
            screenshotCaptureArmed = false
            AccessibilityScreenshotCapture.capture(this) { bitmap, error ->
                ScreenshotAnalysisControl.displayCapturedScreenshot(bitmap, error, eventPackage)
            }
        }
        pendingTap?.takeIf { it.targetPackage == eventPackage }?.let { processPendingTap(it) }
        pendingSwipe?.takeIf { it.targetPackage == eventPackage }?.let { processPendingSwipe(it) }
        if (!scanArmed) return
        val snapshot = inspectWindow() ?: return
        if (snapshot.packageName.isNotBlank() && snapshot.packageName != packageName) {
            latestSnapshot = snapshot
            Log.d(TAG, "User-armed scan captured package=" + snapshot.packageName +
                ", nodes=" + snapshot.nodeCount)
        }
    }
    override fun onInterrupt() {
        screenshotCaptureArmed = false
        FocusedTextEntry.cancel()
        latestForegroundPackage = ""
        Log.i(TAG, "Accessibility service interrupted by system")
    }
    override fun onDestroy() {
        screenshotCaptureArmed = false
        FocusedTextEntry.cancel()
        if (activeService === this) activeService = null
        latestForegroundPackage = ""
        super.onDestroy()
    }
    private fun processPendingSwipe(swipe: PendingSwipe) {
        val root = rootInActiveWindow
        if (root == null) {
            swipe.targetEventsRemaining -= 1
            if (swipe.targetEventsRemaining <= 0) finishSwipe("লক্ষ্য স্ক্রিন পাওয়া যায়নি; স্ক্রল করা হয়নি।")
            return
        }
        try {
            if (root.packageName?.toString() != swipe.targetPackage) return
            val metrics = resources.displayMetrics
            val width = metrics.widthPixels.toFloat()
            val height = metrics.heightPixels.toFloat()
            val startX: Float
            val startY: Float
            val endX: Float
            val endY: Float
            when (swipe.direction) {
                AgentAction.Direction.UP -> { startX = width * .5f; startY = height * .78f; endX = width * .5f; endY = height * .28f }
                AgentAction.Direction.DOWN -> { startX = width * .5f; startY = height * .28f; endX = width * .5f; endY = height * .78f }
                AgentAction.Direction.LEFT -> { startX = width * .78f; startY = height * .5f; endX = width * .22f; endY = height * .5f }
                AgentAction.Direction.RIGHT -> { startX = width * .22f; startY = height * .5f; endX = width * .78f; endY = height * .5f }
            }
            val path = Path().apply { moveTo(startX, startY); lineTo(endX, endY) }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0, 350))
                .build()
            pendingSwipe = null
            val accepted = dispatchGesture(gesture, object : GestureResultCallback() {
                override fun onCompleted(description: GestureDescription?) {
                    latestActionResult = "স্ক্রল gesture সম্পন্ন হয়েছে।"
                }
                override fun onCancelled(description: GestureDescription?) {
                    latestActionResult = "Android gesture বাতিল করেছে; স্ক্রল সম্পন্ন হয়নি।"
                }
            }, null)
            if (!accepted) latestActionResult = "Android gesture গ্রহণ করেনি; স্ক্রল করা হয়নি।"
        } finally {
            AccessibilityScreenInspector.recycle(root)
        }
    }
    private fun finishSwipe(message: String) {
        latestActionResult = message
        pendingSwipe = null
    }
    private fun processPendingTap(tap: PendingSemanticTap) {
        val root = rootInActiveWindow
        if (root == null) {
            failAfterBudget(tap, "লক্ষ্য স্ক্রিন পাওয়া যায়নি; কোনো ট্যাপ করা হয়নি।")
            return
        }
        try {
            if (root.packageName?.toString() != tap.targetPackage) return
            when (AccessibilityScreenInspector.tapExact(root, tap.visibleText)) {
                ExactTapResult.NO_MATCH -> failAfterBudget(tap, "লক্ষ্য লেবেল এখনো পাওয়া যায়নি।")
                ExactTapResult.CLICKED -> finishTap("নির্দিষ্ট UI লেবেলে একবার ট্যাপ করা হয়েছে।")
                ExactTapResult.NOT_CLICKABLE -> finishTap("লেবেল পাওয়া গেছে কিন্তু নিরাপদ clickable control মেলেনি; কোনো ট্যাপ করা হয়নি।")
                ExactTapResult.AMBIGUOUS -> finishTap("একই লেবেল একাধিক জায়গায় আছে; অস্পষ্টতার কারণে ট্যাপ করা হয়নি।")
            }
        } finally {
            AccessibilityScreenInspector.recycle(root)
        }
    }
    private fun failAfterBudget(tap: PendingSemanticTap, message: String) {
        tap.targetEventsRemaining -= 1
        if (tap.targetEventsRemaining <= 0) finishTap(message)
    }
    private fun finishTap(message: String) {
        latestActionResult = message
        pendingTap = null
    }
    private fun inspectWindow(): ScreenSnapshot? {
        val root = rootInActiveWindow ?: return null
        return try {
            AccessibilityScreenInspector.inspect(root)
        } finally {
            AccessibilityScreenInspector.recycle(root)
        }
    }
    companion object {
        private const val TAG = "MosharrofAgent"
        private const val MAX_LABEL_LENGTH = 80
        @Volatile private var activeService: MosharrofAccessibilityService? = null
        @Volatile private var scanArmed = false
        @Volatile private var screenshotCaptureArmed = false
        @Volatile private var latestSnapshot: ScreenSnapshot? = null
        @Volatile private var latestForegroundPackage: String = ""
        @Volatile private var pendingTap: PendingSemanticTap? = null
        @Volatile private var pendingSwipe: PendingSwipe? = null
        @Volatile private var latestActionResult: String? = null
        fun performGlobalNavigation(destination: AgentAction.NavigationDestination): Boolean {
            val service = activeService ?: return false
            val action = when (destination) {
                AgentAction.NavigationDestination.BACK -> AccessibilityService.GLOBAL_ACTION_BACK
                AgentAction.NavigationDestination.HOME -> AccessibilityService.GLOBAL_ACTION_HOME
                AgentAction.NavigationDestination.NOTIFICATIONS -> AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS
                AgentAction.NavigationDestination.RECENTS -> AccessibilityService.GLOBAL_ACTION_RECENTS
            }
            return service.performGlobalAction(action)
        }
        fun cancelInspection() {
            scanArmed = false
            latestSnapshot = null
        }

        fun stopAllActions() {
            scanArmed = false
            screenshotCaptureArmed = false
            latestSnapshot = null
            pendingTap = null
            pendingSwipe = null
            FocusedTextEntry.cancel()
            latestActionResult = "সব অপেক্ষমাণ ডিভাইস-অ্যাকশন থামানো হয়েছে।"
        }
        fun startInspection() {
            latestSnapshot = null
            scanArmed = true
        }
        fun armScreenshotCapture(): Boolean {
            if (activeService == null) return false
            screenshotCaptureArmed = true
            return true
        }
        fun inspectCurrentScreenNow(): ScreenSnapshot? = activeService?.inspectWindow()
        fun foregroundPackage(): String = latestForegroundPackage
        fun takeInspectionSnapshot(): ScreenSnapshot? {
            scanArmed = false
            return latestSnapshot.also { latestSnapshot = null }
        }
        fun armTextEntry(targetPackage: String, text: String): Boolean =
            activeService != null && FocusedTextEntry.arm(targetPackage, text)
        fun armSemanticTap(targetPackage: String, visibleText: String): Boolean {
            if (activeService == null || targetPackage.isBlank() || visibleText.isBlank() ||
                visibleText.length > MAX_LABEL_LENGTH || pendingTap != null
            ) return false
            latestActionResult = null
            pendingTap = PendingSemanticTap(targetPackage, visibleText)
            return true
        }
        fun cancelSemanticTap() {
            pendingTap = null
            pendingSwipe = null
            FocusedTextEntry.cancel()
        }
        fun armSwipe(targetPackage: String, direction: AgentAction.Direction): Boolean {
            if (activeService == null || targetPackage.isBlank() || pendingTap != null || pendingSwipe != null) return false
            latestActionResult = null
            pendingSwipe = PendingSwipe(targetPackage, direction)
            return true
        }
        fun takeActionResult(): String? = latestActionResult.also { latestActionResult = null }
        fun isInspectionArmed(): Boolean = scanArmed
        fun hasInspectionSnapshot(): Boolean = latestSnapshot != null
    }
}
