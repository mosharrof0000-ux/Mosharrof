package com.mosharrof.agent

import android.content.DialogInterface
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
        var visible = false
        activityRule.scenario.onActivity { activity ->
            val decor = activity.window.decorView
            val target = findTextView(decor, expected)
            assertNotNull("Expected TextView in the activity hierarchy: $expected", target)
            if (target != null) {
                val scroll = findScrollView(decor)
                if (scroll != null) {
                    val scrollLocation = IntArray(2)
                    val targetLocation = IntArray(2)
                    scroll.getLocationOnScreen(scrollLocation)
                    target.getLocationOnScreen(targetLocation)
                    scroll.scrollTo(0, (targetLocation[1] - scrollLocation[1]).coerceAtLeast(0))
                }
                val visibleRect = Rect()
                visible = target.isShown && target.getGlobalVisibleRect(visibleRect)
            }
        }
        device.waitForIdle()
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
            "Accessibility সেটিংস খুলুন"
        ).forEach(::assertActivityTextVisible)
    }

    @Test
    fun accessibilityDisclosureRequiresExplicitConsent() {
        activityRule.scenario.onActivity { activity ->
            val preferences = activity.getSharedPreferences(
                "mosharrof_privacy",
                android.content.Context.MODE_PRIVATE
            )
            preferences.edit().clear().commit()
            assertNotNull(
                "Accessibility settings entry must exist in the Activity hierarchy",
                findTextView(activity.window.decorView, "Accessibility সেটিংস খুলুন")
            )

            val accepted = booleanArrayOf(false)
            val dialog = AccessibilityConsentDialog.show(activity) { accepted[0] = true }
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
            assertFalse("Settings callback must not run before consent", accepted[0])

            dialog.getButton(DialogInterface.BUTTON_NEGATIVE).performClick()
            assertFalse("Dismissing consent must not authorize Settings", accepted[0])
            assertFalse("Negative action should dismiss the dialog", dialog.isShowing)

            val confirmation = AccessibilityConsentDialog.show(activity) { accepted[0] = true }
                ?: throw AssertionError("Consent dialog should be shown again until accepted")
            confirmation.getButton(DialogInterface.BUTTON_POSITIVE).performClick()
            assertTrue("Only the positive consent action may authorize Settings", accepted[0])
            assertTrue(
                "Explicit consent must be persisted",
                preferences.getBoolean("accessibility_disclosure_consented", false)
            )
        }
    }
}
