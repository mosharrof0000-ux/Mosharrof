package com.mosharrof.agent.execution

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.TextView
import com.mosharrof.agent.accessibility.MosharrofAccessibilityService
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.TaskPlan
import com.mosharrof.agent.planner.TaskPlanner
import com.mosharrof.agent.policy.ActionPolicy
import com.mosharrof.agent.policy.PolicyDecision
/** Owns pending task state and performs only explicitly confirmed, bounded actions. */
class AgentTaskController(
    private val activity: Activity,
    private val status: TextView,
    private val confirmButton: Button,
    private val isServiceEnabled: () -> Boolean
) {
    private val planner = TaskPlanner()
    private val appCatalog by lazy { InstalledAppCatalog(activity) }
    private val settingsLauncher by lazy { SystemSettingsLauncher(activity) }
    private var pendingApp: com.mosharrof.agent.planner.InstalledApp? = null
    private var pendingSettings: TaskPlan? = null
    private var pendingTap: TaskPlan.TapVisibleText? = null
    private var pendingSwipe: TaskPlan.SwipeScreen? = null
    private var pendingText: TaskPlan.TypeText? = null
    private var pendingNavigation: AgentAction.NavigationDestination? = null
    private var pendingSystemIntent: TaskPlan.SystemIntent? = null
    fun prepareTask(command: String): Boolean {
        clearPending()
        confirmButton.isEnabled = false
        val plan = planner.plan(command, appCatalog.listLauncherApps())
        when (plan) {
            is TaskPlan.OpenApp -> {
                pendingApp = plan.app
                status.text = "পরিকল্পনা: ${plan.app.label} খুলবে। চালানোর আগে নিশ্চিত করুন।"
                confirmButton.isEnabled = true
            }
            is TaskPlan.SystemIntent -> {
                pendingSystemIntent = plan
                status.text = when (plan.kind) {
                    com.mosharrof.agent.planner.DeviceIntentRequest.Kind.DIAL ->
                        "পরিকল্পনা: ডায়ালার খুলে ${plan.target} নম্বরটি প্রস্তুত করা হবে; কল নিজে নিশ্চিত করতে হবে।"
                    com.mosharrof.agent.planner.DeviceIntentRequest.Kind.COMPOSE_SMS ->
                        "পরিকল্পনা: ${plan.target} নম্বরে SMS খসড়া খোলা হবে। পাঠানোর আগে মেসেজটি যাচাই করে নিজে পাঠাবেন।"
                    com.mosharrof.agent.planner.DeviceIntentRequest.Kind.SET_TIMER ->
                        "পরিকল্পনা: ${plan.seconds} সেকেন্ডের টাইমার Android Clock-এ তৈরি হবে। নিশ্চিত করুন।"
                    com.mosharrof.agent.planner.DeviceIntentRequest.Kind.CREATE_CALENDAR_EVENT ->
                        "পরিকল্পনা: ‘${plan.text}’ শিরোনামে Calendar ইভেন্ট খসড়া খোলা হবে; সময়/বিস্তারিত নিজে যাচাই করবেন।"
                }
                confirmButton.isEnabled = true
            }
            is TaskPlan.GlobalNavigation -> {
                pendingNavigation = plan.destination
                val label = when (plan.destination) {
                    AgentAction.NavigationDestination.BACK -> "এক ধাপ পেছনে যাওয়া"
                    AgentAction.NavigationDestination.HOME -> "হোম স্ক্রিন খোলা"
                    AgentAction.NavigationDestination.NOTIFICATIONS -> "নোটিফিকেশন প্যানেল খোলা"
                    AgentAction.NavigationDestination.RECENTS -> "সাম্প্রতিক অ্যাপ দেখানো"
                }
                status.text = "পরিকল্পনা: $label হবে। নিশ্চিত করুন।"
                confirmButton.isEnabled = isServiceEnabled()
            }
            is TaskPlan.SwipeScreen -> {
                pendingSwipe = plan
                status.text = "পরিকল্পনা: ${plan.app.label}-এ ${plan.direction.name.lowercase()} দিকে একবার স্ক্রল হবে। নিশ্চিত করুন।"
                confirmButton.isEnabled = isServiceEnabled()
            }
            is TaskPlan.TypeText -> {
                pendingText = plan
                status.text = "পরিকল্পনা: ${plan.app.label}-এ “${plan.text}” লেখা হবে। নিশ্চিত করলে অ্যাপ খুলবে; ৩০ সেকেন্ডে আপনি ইনপুট ঘরে ট্যাপ করলে লেখা বসবে, পাঠানো হবে না।"
                confirmButton.isEnabled = isServiceEnabled()
            }
            is TaskPlan.TapVisibleText -> {
                pendingTap = plan
                status.text = if (isServiceEnabled()) {
                    "পরিকল্পনা: ${plan.app.label}-এ ‘${plan.text}’ লেবেলে একবার ট্যাপ হবে। নিশ্চিত করুন।"
                } else {
                    "এই UI action-এর জন্য আগে Accessibility চালু করুন।"
                }
                confirmButton.isEnabled = isServiceEnabled()
            }
            TaskPlan.OpenSystemSettings -> prepareSettings(plan, "Android Settings")
            is TaskPlan.OpenSettingPanel -> prepareSettings(plan, settingsLauncher.label(plan.setting))
            is TaskPlan.NeedsChoice -> status.text =
                "একাধিক/আংশিক মিল: ${plan.candidates.joinToString { it.label }}। সঠিক অ্যাপের পুরো নাম লিখুন।"
            is TaskPlan.Rejected -> status.text = "কমান্ড চালানো হয়নি: ${plan.reason}"
        }
        return plan !is TaskPlan.Rejected
    }

    fun installedAppLabels(): List<String> =
        appCatalog.listLauncherApps().map { it.label }.distinct().take(100)

    fun confirmPending() {
        when {
            pendingApp != null -> launchConfirmedApp()
            pendingSettings != null -> launchConfirmedSettings()
            pendingTap != null -> launchConfirmedTap()
            pendingText != null -> launchConfirmedText()
            pendingSwipe != null -> launchConfirmedSwipe()
            pendingNavigation != null -> launchConfirmedNavigation()
            pendingSystemIntent != null -> launchConfirmedSystemIntent()
        }
    }
    fun cancelPending() {
        clearPending()
        MosharrofAccessibilityService.stopAllActions()
        confirmButton.isEnabled = false
        status.text = "অপেক্ষমাণ কাজ বাতিল হয়েছে।"
    }
    private fun clearPending() {
        pendingApp = null
        pendingSettings = null
        pendingTap = null
        pendingSwipe = null
        pendingText = null
        pendingNavigation = null
        pendingSystemIntent = null
    }
    private fun prepareSettings(plan: TaskPlan, label: String) {
        pendingSettings = plan
        status.text = "পরিকল্পনা: $label খোলা হবে। চালানোর আগে নিশ্চিত করুন।"
        confirmButton.isEnabled = true
    }
    private fun launchConfirmedSettings() {
        val plan = pendingSettings ?: return
        status.text = settingsLauncher.launch(plan)
        pendingSettings = null
        confirmButton.isEnabled = false
    }
    private fun launchConfirmedSystemIntent() {
        val request = pendingSystemIntent ?: return
        status.text = DeviceIntentLauncher(activity).launch(request)
        pendingSystemIntent = null
        confirmButton.isEnabled = false
    }
    private fun launchConfirmedNavigation() {
        val destination = pendingNavigation ?: return
        if (!isServiceEnabled()) {
            status.text = "Accessibility বন্ধ; কোনো নেভিগেশন করা হয়নি।"
            return
        }
        val policy = ActionPolicy(appCatalog.listLauncherApps().map { it.packageName }.toSet())
        val decision = policy.evaluate(AgentAction.GlobalNavigation(destination), 0)
        if (decision.decision == PolicyDecision.DENY) {
            status.text = "নিরাপত্তা নীতিতে বাধা: ${decision.reason}"
            return
        }
        val success = MosharrofAccessibilityService.performGlobalNavigation(destination)
        status.text = if (success) "নেভিগেশন অনুরোধ Android গ্রহণ করেছে।" else "Android নেভিগেশন অনুরোধ গ্রহণ করেনি।"
        pendingNavigation = null
        confirmButton.isEnabled = false
    }
    private fun launchConfirmedSwipe() {
        val plan = pendingSwipe ?: return
        val result = AgentUiActionExecutor.launchSwipe(activity, plan, isServiceEnabled())
        status.text = result.message
        if (result.started) {
            pendingSwipe = null
            confirmButton.isEnabled = false
            watchActionResult("স্ক্রল", 0)
        }
    }
    private fun launchConfirmedTap() {
        val plan = pendingTap ?: return
        val result = AgentUiActionExecutor.launchTap(activity, plan, isServiceEnabled())
        status.text = result.message
        if (result.started) {
            pendingTap = null
            confirmButton.isEnabled = false
            watchActionResult("ট্যাপ", 0)
        }
    }
    private fun watchActionResult(label: String, attempt: Int) {
        Handler(Looper.getMainLooper()).postDelayed({
            if (activity.isFinishing || activity.isDestroyed) return@postDelayed
            val result = MosharrofAccessibilityService.takeActionResult()
            if (result != null) {
                status.text = "$label ফলাফল: $result"
            } else if (attempt < 24) {
                watchActionResult(label, attempt + 1)
            } else {
                MosharrofAccessibilityService.stopAllActions()
                status.text = "$label-এর ফল ১২ সেকেন্ডেও যাচাই করা যায়নি; action বন্ধ করা হয়েছে।"
            }
        }, 500L)
    }
    private fun launchConfirmedText() {
        val plan = pendingText ?: return
        if (!isServiceEnabled()) {
            status.text = "Accessibility বন্ধ; লেখা প্রবেশ করানো হয়নি।"
            return
        }
        val allowed = appCatalog.listLauncherApps().map { it.packageName }.toSet()
        val decision = ActionPolicy(allowed).evaluate(
            AgentAction.TypeText(plan.app.packageName, plan.text), 0
        )
        if (decision.decision != PolicyDecision.REQUIRE_CONFIRMATION) {
            status.text = "নিরাপত্তা নীতিতে লেখা প্রবেশ অনুমোদিত নয়: ${decision.reason}"
            return
        }
        if (!MosharrofAccessibilityService.armTextEntry(plan.app.packageName, plan.text)) {
            status.text = "Accessibility service প্রস্তুত নয়; লেখা প্রবেশ করানো হয়নি।"
            return
        }
        if (!appCatalog.launch(plan.app.packageName)) {
            MosharrofAccessibilityService.cancelSemanticTap()
            status.text = "লক্ষ্য অ্যাপ খোলা যায়নি; লেখা প্রবেশ করানো হয়নি।"
            return
        }
        status.text = "অ্যাপ খুলছে। ৩০ সেকেন্ডের মধ্যে কাঙ্ক্ষিত ইনপুট ঘরে ট্যাপ করুন; লেখা বসবে, স্বয়ংক্রিয়ভাবে পাঠানো হবে না।"
        pendingText = null
        confirmButton.isEnabled = false
    }
    private fun verifyForegroundApp(app: com.mosharrof.agent.planner.InstalledApp, attempt: Int) {
        Handler(Looper.getMainLooper()).postDelayed({
            if (activity.isFinishing || activity.isDestroyed) return@postDelayed
            val foreground = MosharrofAccessibilityService.foregroundPackage()
            if (foreground == app.packageName) {
                status.text = "যাচাই সফল: ${app.label} সামনে খোলা আছে."
            } else if (attempt < 2) {
                verifyForegroundApp(app, attempt + 1)
            } else {
                status.text = "${app.label} খোলার অনুরোধ পাঠানো হয়েছে, কিন্তু সামনে খোলা নিশ্চিত করা যায়নি। বর্তমান প্যাকেজ: ${foreground.ifBlank { "অজানা" }}।"
            }
        }, 900L)
    }
    private fun launchConfirmedApp() {
        val app = pendingApp ?: return
        val allowed = appCatalog.listLauncherApps().map { it.packageName }.toSet()
        val decision = ActionPolicy(allowed).evaluate(AgentAction.OpenApp(app.packageName, userRequested = true), 0)
        if (decision.decision != PolicyDecision.ALLOW) {
            status.text = "নিরাপত্তা নীতিতে বাধা: ${decision.reason}"
            return
        }
        if (!appCatalog.launch(app.packageName)) {
            status.text = "অ্যাপটি খোলা যায়নি; অ্যাপটি সরানো বা নিষ্ক্রিয় থাকতে পারে।"
            return
        }
        status.text = "${app.label} খোলার অনুরোধ পাঠানো হয়েছে।"
        pendingApp = null
        confirmButton.isEnabled = false
    }
}