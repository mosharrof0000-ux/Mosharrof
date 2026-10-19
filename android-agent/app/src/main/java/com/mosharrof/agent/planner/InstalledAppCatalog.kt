package com.mosharrof.agent.planner

import android.content.Context
import android.content.Intent

/** Builds a label-to-package map from launchable apps visible to Android. */
class InstalledAppCatalog(private val context: Context) {
    fun load(): Map<String, String> {
        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return context.packageManager.queryIntentActivities(launcherIntent, 0)
            .mapNotNull { info ->
                val packageName = info.activityInfo?.packageName ?: return@mapNotNull null
                val label = info.loadLabel(context.packageManager)?.toString()
                    ?.trim()?.lowercase().orEmpty()
                if (label.isBlank() || packageName == context.packageName) null
                else label to packageName
            }
            .distinctBy { it.first }
            .toMap()
    }
}
