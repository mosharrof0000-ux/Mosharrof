package com.mosharrof.agent.execution

import android.app.Activity
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.TaskPlan
import com.mosharrof.agent.policy.ActionPolicy
import com.mosharrof.agent.policy.PolicyDecision

internal data class UiActionLaunchResult(val message: String, val started: Boolean)

/** Executes only a user-confirmed single tap or swipe against an explicitly resolved app. */
internal object AgentUiActionExecutor {
    fun launchSwipe(activity: Activity, plan: TaskPlan.SwipeScreen, serviceEnabled: Boolean): UiActionLaunchResult {
        if (!serviceEnabled) return UiActionLaunchResult("Accessibility বন্ধ; কোনো স্ক্রল করা হয়নি।", false)
        val catalog = InstalledAppCatalog(activity)
        val allowed = catalog.listLauncherApps().map { it.packageName }.toSet()
        val decision = ActionPolicy(allowed).evaluate(AgentAction.Swipe(plan.app.packageName, plan.direction), 0)
        if (decision.decision == PolicyDecision.DENY) return UiActionLaunchResult("নিরাপত্তা নীতিতে বাধা: ${decision.reason}", false)
        if (!MosharrofAccessibilityService.armSwipe(plan.app.packageName, plan.direction)) {
            return UiActionLaunchResult("Accessibility service প্রস্তুত নয় বা অন্য action চলছে; স্ক্রল করা হয়নি।", false)
        }
        if (!catalog.launch(plan.app.packageName)) {
            MosharrofAccessibilityService.cancelSemanticTap()
            return UiActionLaunchResult("লক্ষ্য অ্যাপ খোলা যায়নি; স্ক্রল করা হয়নি।", false)
        }
        return UiActionLaunchResult("লক্ষ্য অ্যাপ খুলছে; লক্ষ্য স্ক্রিনে পৌঁছালে একবার স্ক্রল হবে।", true)
    }

    fun launchTap(activity: Activity, plan: TaskPlan.TapVisibleText, serviceEnabled: Boolean): UiActionLaunchResult {
        if (!serviceEnabled) return UiActionLaunchResult("Accessibility বন্ধ; কোনো ট্যাপ করা হয়নি।", false)
        val catalog = InstalledAppCatalog(activity)
        val allowed = catalog.listLauncherApps().map { it.packageName }.toSet()
        val decision = ActionPolicy(allowed).evaluate(AgentAction.TapSemanticNode(plan.app.packageName, visibleText = plan.text), 0)
        if (decision.decision == PolicyDecision.DENY) return UiActionLaunchResult("নিরাপত্তা নীতিতে বাধা: ${decision.reason}", false)
        if (!MosharrofAccessibilityService.armSemanticTap(plan.app.packageName, plan.text)) {
            return UiActionLaunchResult("Accessibility service প্রস্তুত নয় বা অন্য action চলছে; কোনো ট্যাপ করা হয়নি।", false)
        }
        if (!catalog.launch(plan.app.packageName)) {
            MosharrofAccessibilityService.cancelSemanticTap()
            return UiActionLaunchResult("লক্ষ্য অ্যাপ খোলা যায়নি; কোনো ট্যাপ করা হয়নি।", false)
        }
        return UiActionLaunchResult("লক্ষ্য অ্যাপ খুলছে। নির্দিষ্ট লেবেল একবারই মিললে ট্যাপ হবে; অস্পষ্ট হলে বাতিল হবে।", true)
    }
}
