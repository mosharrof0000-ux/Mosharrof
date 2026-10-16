package com.mosharrof.agent.execution

import android.app.Activity
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.TaskPlan
import com.mosharrof.agent.policy.ActionPolicy
import com.mosharrof.agent.policy.PolicyDecision

internal data class TextEntryLaunchResult(val message: String, val started: Boolean)

/** Launches the explicitly selected app and arms one-shot text insertion; never submits it. */
internal object AgentTextEntryExecutor {
    fun launch(activity: Activity, plan: TaskPlan.TypeText, isServiceEnabled: Boolean): TextEntryLaunchResult {
        if (!isServiceEnabled) return TextEntryLaunchResult("Accessibility বন্ধ; লেখা প্রবেশ করানো হয়নি।", false)
        val catalog = InstalledAppCatalog(activity)
        val allowed = catalog.listLauncherApps().map { it.packageName }.toSet()
        val decision = ActionPolicy(allowed).evaluate(AgentAction.TypeText(plan.app.packageName, plan.text), 0)
        if (decision.decision == PolicyDecision.DENY) {
            return TextEntryLaunchResult("নিরাপত্তা নীতিতে বাধা: ${decision.reason}", false)
        }
        if (!MosharrofAccessibilityService.armTextEntry(plan.app.packageName, plan.text)) {
            return TextEntryLaunchResult("Text entry প্রস্তুত নয় বা অন্য লেখা অপেক্ষমাণ; লেখা প্রবেশ করানো হয়নি।", false)
        }
        if (!catalog.launch(plan.app.packageName)) {
            MosharrofAccessibilityService.cancelSemanticTap()
            return TextEntryLaunchResult("লক্ষ্য অ্যাপ খোলা যায়নি; লেখা প্রবেশ করানো হয়নি।", false)
        }
        return TextEntryLaunchResult(
            "লক্ষ্য অ্যাপ খুলছে। ওই অ্যাপে ইনপুট ক্ষেত্র ফোকাসে এলে লেখা বসানো হবে; পাঠানো হবে না।", true
        )
    }
}
