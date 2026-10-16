package com.mosharrof.agent.execution

import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.planner.IntentPlanner

/** Executes only the narrow launch actions supported by the current MVP. */
class TaskDispatcher(private val context: Context) {
    fun dispatch(result: IntentPlanner.PlanResult): String = when (result) {
        is IntentPlanner.PlanResult.NeedsClarification -> result.message
        IntentPlanner.PlanResult.OpenSystemSettings -> openSettings()
        is IntentPlanner.PlanResult.Action -> dispatchAction(result.action)
    }

    private fun openSettings(): String = runCatching {
        context.startActivity(
            Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        "সেটিংস খোলা হয়েছে।"
    }.getOrElse { "সেটিংস খোলা যায়নি: ${it.message ?: "অজানা সমস্যা"}" }

    private fun dispatchAction(action: AgentAction): String = when (action) {
        is AgentAction.OpenApp -> {
            if (!action.userRequested) return "অ্যাপ খোলার আগে স্পষ্ট নির্দেশ দরকার।"
            runCatching {
                val intent = context.packageManager.getLaunchIntentForPackage(action.packageName)
                    ?: return "এই অ্যাপটি ইনস্টল নেই বা খোলা যাচ্ছে না।"
                context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                "অ্যাপ খোলা হয়েছে: ${action.packageName}"
            }.getOrElse { "অ্যাপ খোলা যায়নি: ${it.message ?: "অজানা সমস্যা"}" }
        }
        else -> "এই ধরনের কাজের executor এখনো বাস্তবায়িত হয়নি। কোনো পরিবর্তন করা হয়নি।"
    }
}
