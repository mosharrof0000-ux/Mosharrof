package com.mosharrof.agent.command

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.mosharrof.agent.planner.CommandParser
import com.mosharrof.agent.planner.ParsedCommand
import com.mosharrof.agent.planner.AgentAction
import com.mosharrof.agent.policy.ActionPolicy
import com.mosharrof.agent.policy.PolicyDecision

data class CommandResult(val success: Boolean, val message: String)

/** Executes only explicit commands and never taps arbitrary screen controls. */
class AgentCommandExecutor(private val context: Context) {
    private val parser = CommandParser()

    fun execute(rawCommand: String): CommandResult {
        return try {
            when (val command = parser.parse(rawCommand)) {
                ParsedCommand.Unknown ->
                    CommandResult(false, "কমান্ডটি বুঝতে পারিনি। নির্দিষ্ট অ্যাপের package name দিন।")
                ParsedCommand.OpenSystemSettings -> launchSettings(Settings.ACTION_SETTINGS)
                is ParsedCommand.OpenSettingPanel -> openSettingPanel(command.setting)
                is ParsedCommand.OpenApp -> openExplicitApp(command.packageName)
            }
        } catch (_: ActivityNotFoundException) {
            CommandResult(false, "এই কাজের জন্য Android-এ উপযুক্ত অ্যাপ বা সেটিংস পাওয়া যায়নি।")
        } catch (_: SecurityException) {
            CommandResult(false, "Android নিরাপত্তার কারণে কাজটি অনুমোদন করেনি।")
        }
    }

    private fun openExplicitApp(packageName: String): CommandResult {
        val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: return CommandResult(false, "অ্যাপটি ইনস্টল নেই অথবা খোলা যায় না: $packageName")
        val policy = ActionPolicy(setOf(packageName))
        val decision = policy.evaluate(AgentAction.OpenApp(packageName, userRequested = true), 0)
        if (decision.decision != PolicyDecision.ALLOW) {
            return CommandResult(false, "নিরাপত্তা নীতিতে অ্যাপ খোলা অনুমোদিত হয়নি।")
        }
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launchIntent)
        return CommandResult(true, "অ্যাপ খোলা হচ্ছে: $packageName")
    }

    private fun openSettingPanel(setting: AgentAction.SupportedSetting): CommandResult {
        val intent = when (setting) {
            AgentAction.SupportedSetting.WIFI_PANEL ->
                Intent(Settings.Panel.ACTION_WIFI)
            AgentAction.SupportedSetting.BLUETOOTH_PANEL ->
                Intent(Settings.Panel.ACTION_BLUETOOTH)
            AgentAction.SupportedSetting.LOCATION_SETTINGS ->
                Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return CommandResult(true, "Android সেটিংস খোলা হয়েছে। পরিবর্তনটি আপনি নিজে নিশ্চিত করুন।")
    }

    private fun launchSettings(action: String): CommandResult {
        context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        return CommandResult(true, "Android Settings খোলা হচ্ছে।")
    }
}
