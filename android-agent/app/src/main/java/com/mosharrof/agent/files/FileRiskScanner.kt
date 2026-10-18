package com.mosharrof.agent.files

import java.util.Locale

enum class FileRiskLevel { REVIEW, ELEVATED, HIGH }

data class FileRiskFinding(
    val level: FileRiskLevel,
    val reasons: List<String>,
    val hashSha256: String? = null
)

/**
 * Local triage, not an antivirus engine. It checks names/extensions only; it does not execute,
 * unpack, or upload files and cannot prove a file is malware-free.
 */
object FileRiskScanner {
    private val executableLike = setOf("apk", "xapk", "apks", "exe", "dll", "scr", "bat", "cmd", "com", "js", "vbs", "ps1", "sh")
    private val doubleExtensionTargets = setOf("jpg", "jpeg", "png", "gif", "pdf", "mp3", "mp4", "doc", "docx")

    fun inspect(fileName: String, mimeType: String? = null): FileRiskFinding {
        val clean = fileName.substringAfterLast('/').substringAfterLast('\\')
        val parts = clean.split('.').filter { it.isNotBlank() }
        val extension = parts.lastOrNull()?.lowercase(Locale.ROOT).orEmpty()
        val reasons = mutableListOf<String>()
        val hidden = clean.startsWith(".")
        if (hidden) reasons += "লুকানো ফাইলের নাম—পর্যালোচনা করুন"
        if (extension in executableLike) reasons += "চালানো যায় বা ইনস্টল হতে পারে এমন ফাইলের ধরন ($extension)"
        if (parts.size >= 3 && parts[parts.lastIndex - 1].lowercase(Locale.ROOT) in doubleExtensionTargets &&
            extension in executableLike
        ) reasons += "ছবি/ডকুমেন্টের মতো নামের পরে executable extension আছে"
        if (clean.length > 180) reasons += "অস্বাভাবিক দীর্ঘ ফাইলের নাম"
        if (mimeType != null && mimeType.startsWith("image/") && extension in executableLike) {
            reasons += "MIME type ও ফাইল extension পরস্পর মেলে না"
        }
        val level = when {
            reasons.any { it.contains("executable extension") || it.contains("MIME type") } -> FileRiskLevel.HIGH
            extension in executableLike -> FileRiskLevel.ELEVATED
            reasons.isNotEmpty() -> FileRiskLevel.REVIEW
            else -> FileRiskLevel.REVIEW // unknown is not equivalent to safe
        }
        return FileRiskFinding(level, reasons.ifEmpty { listOf("শুধু নামভিত্তিক প্রাথমিক পরীক্ষা; নিরাপদ বলে নিশ্চিত করা যায় না") })
    }
}
