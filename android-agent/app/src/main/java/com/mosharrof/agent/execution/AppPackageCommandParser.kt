package com.mosharrof.agent.execution

/** Small, deterministic command vocabulary; never infers a destructive target. */
sealed interface AppPackageCommand {
    data object NotRecognized : AppPackageCommand
    data object PickApk : AppPackageCommand
    data object AskUninstallTarget : AppPackageCommand
    data class SearchStore(val query: String) : AppPackageCommand
    data class Uninstall(val target: String) : AppPackageCommand
}

object AppPackageCommandParser {
    fun parse(raw: String): AppPackageCommand {
        val command = raw.trim()
        if (command.isEmpty() || command.length > 240 || command.any { it.isISOControl() }) return AppPackageCommand.NotRecognized
        val lower = command.lowercase()
        if (lower in setOf("install app", "install apk", "অ্যাপ ইনস্টল করো", "অ্যাপ ইনস্টল করুন", "ইনস্টল করো", "ইনস্টল করুন")) {
            return AppPackageCommand.PickApk
        }
        val installPrefixes = listOf("install app ", "install ", "অ্যাপ ইনস্টল ", "ইনস্টল করো ", "ইনস্টল করুন ")
        val installTarget = installPrefixes.firstOrNull { lower.startsWith(it) }?.let { command.drop(it.length).trim() }
        if (installTarget != null) {
            if (installTarget.isBlank() || installTarget.equals("apk", true) || installTarget.equals("app", true) ||
                installTarget.equals("অ্যাপ", true) || installTarget.contains("apk", true) || installTarget.contains("ফাইল")) {
                return AppPackageCommand.PickApk
            }
            return AppPackageCommand.SearchStore(installTarget)
        }
        if (lower in setOf("uninstall app", "অ্যাপ আনইনস্টল করো", "আনইনস্টল করো", "আনইনস্টল করুন")) {
            return AppPackageCommand.AskUninstallTarget
        }
        val uninstallPrefixes = listOf("uninstall ", "remove app ", "অ্যাপ আনইনস্টল ", "আনইনস্টল করো ", "আনইনস্টল করুন ")
        val target = uninstallPrefixes.firstOrNull { lower.startsWith(it) }?.let { command.drop(it.length).trim() }
            ?: listOf(" আনইনস্টল করো", " আনইনস্টল করুন", " uninstall", " remove")
                .firstOrNull { lower.endsWith(it) }?.let { command.dropLast(it.length).trim() }
        if (target != null) return if (target.isBlank()) AppPackageCommand.AskUninstallTarget else AppPackageCommand.Uninstall(target)
        return AppPackageCommand.NotRecognized
    }
}
