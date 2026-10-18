package com.mosharrof.agent

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.TextView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
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
            "ডিভাইসের অবস্থা পরীক্ষা করুন"
        ).forEach(::assertActivityTextVisible)
    }

    @Test
    fun accessibilityDisclosureAppearsBeforeSettingsCanOpen() {
        activityRule.scenario.onActivity { activity ->
            activity.getSharedPreferences("mosharrof_privacy", android.content.Context.MODE_PRIVATE)
                .edit().clear().commit()
        }
        device.waitForIdle()

        activityRule.scenario.onActivity { activity ->
            val button = findTextView(activity.window.decorView, "Accessibility সেটিংস খুলুন")
            assertNotNull("Accessibility settings button should exist in the activity hierarchy", button)
            button?.performClick()
        }

        assertNotNull(
            "Consent dialog title should appear before opening system settings",
            device.wait(Until.findObject(By.text("স্ক্রিন নিয়ন্ত্রণের অনুমতি")), 5_000)
        )
        assertNotNull(
            "Consent dialog must provide an explicit Settings action",
            device.wait(Until.findObject(By.text("বুঝেছি, Settings খুলুন")), 5_000)
        )
        val dismiss = device.wait(Until.findObject(By.text("এখন নয়")), 5_000)
        assertNotNull("Consent dialog must offer a safe dismissal action", dismiss)
        dismiss?.click()
        device.waitForIdle()
    }
}
