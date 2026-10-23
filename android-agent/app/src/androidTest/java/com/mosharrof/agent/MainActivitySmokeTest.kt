package com.mosharrof.agent

import android.app.AlertDialog
import android.content.DialogInterface
import android.content.SharedPreferences
import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.TextView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import com.mosharrof.agent.execution.AccessibilityConsentDialog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(AndroidJUnit4::class)
class MainActivitySmokeTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    private val device: UiDevice
        get() = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

    private fun findTextView(root: View, expected: String): TextView? {
        if (root is TextView && root.text?.toString() == expected) return root
        if (root is ViewGroup) {
            for (index in 0 until root.childCount) {
                findTextView(root.getChildAt(index), expected)?.let { return it }
            }
        }
        return null
    }

    private fun assertActivityTextVisible(expected: String) {
        lateinit var target: TextView
        activityRule.scenario.onActivity { activity ->
            val decor = activity.window.decorView
            target = findTextView(decor, expected)
                ?: throw AssertionError("Expected TextView in the activity hierarchy: $expected")
            val scroll = findScrollView(decor)
            if (scroll != null) {
                val scrollLocation = IntArray(2)
                val targetLocation = IntArray(2)
                scroll.getLocationOnScreen(scrollLocation)
                target.getLocationOnScreen(targetLocation)
                // targetLocation is viewport-relative after earlier assertions have scrolled.
                // Add the current scroll offset to recover the child's content coordinate.
                val targetContentY = scroll.scrollY + targetLocation[1] - scrollLocation[1]
                scroll.scrollTo(0, targetContentY.coerceAtLeast(0))
                target.requestRectangleOnScreen(Rect(0, 0, target.width, target.height), true)
            }
        }
        // Wait outside the Activity's UI-thread callback so Android can complete layout.
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        var visible = false
        activityRule.scenario.onActivity {
            val visibleRect = Rect()
            visible = target.isShown && target.getGlobalVisibleRect(visibleRect) &&
                visibleRect.width() > 0 && visibleRect.height() > 0
        }
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        assertTrue("Expected visible activity text: $expected", visible)
    }

    private fun findScrollView(root: View): ScrollView? {
        if (root is ScrollView) return root
        if (root is ViewGroup) {
            for (index in 0 until root.childCount) {
                findScrollView(root.getChildAt(index))?.let { return it }
            }
        }
        return null
    }

    @Test
    fun commandControlsAreVisibleOnLaunch() {
        device.waitForIdle()
        assertActivityTextVisible("মোশাররফ অটোনোমাস এজেন্ট")
        listOf(
            "কমান্ড যাচাই করুন",
            "কথা বলে কমান্ড দিন",
            "ফলাফল পড়ে শোনান",
            "কণ্ঠ থামান",
            "কাজ বাতিল করুন",
            "ডিভাইসের অবস্থা পরীক্ষা করুন",
            "Accessibility সেটিংস খুলুন",
            "APK ফাইল থেকে অ্যাপ ইনস্টল করুন"
        ).forEach(::assertActivityTextVisible)
    }

    @Test
    fun accessibilityDisclosureRequiresExplicitConsent() {
        lateinit var preferences: SharedPreferences
        lateinit var dialog: AlertDialog
        val accepted = AtomicBoolean(false)

        activityRule.scenario.onActivity { activity ->
            preferences = activity.getSharedPreferences(
                "mosharrof_privacy",
                android.content.Context.MODE_PRIVATE
            )
            preferences.edit().clear().commit()
            val button = findTextView(activity.window.decorView, "Accessibility সেটিংস খুলুন")
                ?: throw AssertionError("Accessibility settings entry must exist in the Activity hierarchy")
            assertNotNull("Accessibility settings entry must exist", button)

            dialog = AccessibilityConsentDialog.show(activity) { accepted.set(true) }
                ?: throw AssertionError("Consent dialog should be shown before consent")
            assertTrue("Consent dialog should be visible", dialog.isShowing)
            val dialogRoot = dialog.window?.decorView
                ?: throw AssertionError("Consent dialog window should exist")
            val title = findTextView(dialogRoot, "স্ক্রিন নিয়ন্ত্রণের অনুমতি")
                ?: throw AssertionError("Consent dialog title should be present")
            assertEquals("স্ক্রিন নিয়ন্ত্রণের অনুমতি", title.text.toString())
            assertEquals(
                "বুঝেছি, Settings খুলুন",
                dialog.getButton(DialogInterface.BUTTON_POSITIVE).text.toString()
            )
            assertEquals(
                "এখন নয়",
                dialog.getButton(DialogInterface.BUTTON_NEGATIVE).text.toString()
            )
            assertFalse("Settings callback must not run before consent", accepted.get())
            dialog.getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
        }

        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        assertFalse("Negative action should dismiss the dialog", dialog.isShowing)
        assertFalse("Dismissing consent must not authorize Settings", accepted.get())

        lateinit var confirmation: AlertDialog
        activityRule.scenario.onActivity { activity ->
            confirmation = AccessibilityConsentDialog.show(activity) { accepted.set(true) }
                ?: throw AssertionError("Consent dialog should be shown again until accepted")
            confirmation.getButton(DialogInterface.BUTTON_POSITIVE).performClick()
        }
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        assertTrue("Only the positive consent action may authorize Settings", accepted.get())
        assertTrue(
            "Explicit consent must be persisted",
            preferences.getBoolean("accessibility_disclosure_consented", false)
        )
    }
}
