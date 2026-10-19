package com.mosharrof.agent.execution

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import com.mosharrof.agent.planner.InstalledApp

/** Lists launcher-visible apps and starts one only after the UI obtains user confirmation. */
class InstalledAppCatalog(private val context: Context) {
    fun listLauncherApps(): List<InstalledApp> {
        val query = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return context.packageManager.queryIntentActivities(query, PackageManager.MATCH_DEFAULT_ONLY)
            .mapNotNull { result ->
                val info = result.activityInfo ?: return@mapNotNull null
                val label = result.loadLabel(context.packageManager)?.toString()
                    ?.trim()?.takeIf(String::isNotEmpty) ?: return@mapNotNull null
                InstalledApp(label, info.packageName)
            }
            .distinctBy(InstalledApp::packageName)
            .sortedBy { it.label.lowercase() }
    }

    fun launch(packageName: String): Boolean {
        val allowed = listLauncherApps().any { it.packageName == packageName }
        if (!allowed) return false
        val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName) ?: return false
        return runCatching {
            context.startActivity(launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }.isSuccess
    }
}
