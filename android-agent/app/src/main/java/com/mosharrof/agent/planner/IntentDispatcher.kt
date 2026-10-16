package com.mosharrof.agent.planner

import android.content.Context
import android.content.Intent
import android.provider.MediaStore
import android.provider.Settings

/** Executes only a parsed, user-confirmed intent through public Android intents. */
class IntentDispatcher(private val context: Context) {
    fun dispatch(intent: AgentIntent): DispatchResult = try {
        when (intent) {
            is AgentIntent.OpenApp -> openApp(intent.appKey)
            is AgentIntent.SearchWeb -> {
                val search = Intent(Intent.ACTION_WEB_SEARCH)
                    .putExtra("query", intent.query)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                launch(search)
            }
            AgentIntent.InspectCurrentScreen ->
                DispatchResult.NotSupported("স্ক্রিন পরিদর্শন এখন শুধু সার্ভিস স্ট্যাটাস দেখে")
            is AgentIntent.Unknown ->
                DispatchResult.NotSupported("কমান্ড বোঝা যায়নি")
        }
    } catch (_: Exception) {
        DispatchResult.Failed("অ্যান্ড্রয়েড এই কাজটি খুলতে পারেনি")
    }

    private fun openApp(key: String): DispatchResult {
        val intent = when (key) {
            "settings" -> Intent(Settings.ACTION_SETTINGS)
            "phone" -> Intent(Intent.ACTION_DIAL)
            "camera" -> Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            "browser" -> Intent(Intent.ACTION_WEB_SEARCH)
            else -> return DispatchResult.NotSupported("এই অ্যাপের কমান্ড এখন সমর্থিত নয়")
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return launch(intent)
    }

    private fun launch(intent: Intent): DispatchResult {
        if (intent.resolveActivity(context.packageManager) == null) {
            return DispatchResult.NotSupported("এই কাজের জন্য উপযুক্ত অ্যাপ পাওয়া যায়নি")
        }
        context.startActivity(intent)
        return DispatchResult.Started
    }
}

sealed interface DispatchResult {
    data object Started : DispatchResult
    data class NotSupported(val message: String) : DispatchResult
    data class Failed(val message: String) : DispatchResult
}
