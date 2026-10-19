package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.graphics.Bitmap
import android.os.Build
import android.view.Display

/** Captures only after the device owner enabled this Accessibility service. */
internal object AccessibilityScreenshotCapture {
    fun isTargetPackage(packageName: String): Boolean =
        packageName.isNotBlank() && packageName !in setOf(
            "com.android.systemui", "com.android.launcher", "com.android.launcher3",
            "com.google.android.apps.nexuslauncher", "com.oplus.launcher"
        )

    fun capture(service: AccessibilityService, callback: (Bitmap?, String?) -> Unit): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            callback(null, "এই Android সংস্করণে Accessibility screenshot API নেই।")
            return false
        }
        service.takeScreenshot(Display.DEFAULT_DISPLAY, service.mainExecutor,
            object : AccessibilityService.TakeScreenshotCallback {
                override fun onSuccess(result: AccessibilityService.ScreenshotResult) {
                    val buffer = result.hardwareBuffer
                    try {
                        val hardwareBitmap = Bitmap.wrapHardwareBuffer(buffer, result.colorSpace)
                        val bitmap = hardwareBitmap?.copy(Bitmap.Config.ARGB_8888, false)
                        hardwareBitmap?.recycle()
                        callback(bitmap, if (bitmap == null) "স্ক্রিনশট bitmap তৈরি করা যায়নি।" else null)
                    } catch (_: Exception) {
                        callback(null, "স্ক্রিনশট রূপান্তর করা যায়নি।")
                    } finally {
                        buffer.close()
                    }
                }

                override fun onFailure(errorCode: Int) {
                    callback(null, "Android screenshot নিতে দেয়নি (code=$errorCode)।")
                }
            })
        return true
    }
}
