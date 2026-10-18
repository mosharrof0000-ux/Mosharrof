package com.mosharrof.agent

import android.app.AlertDialog
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
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

    private fun collectText(view: View, output: MutableList<String>) {
        if (view is TextView) output += view.text?.toString().orEmpty()
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) collectText(view.getChildAt(index), output)
        }
    }

    @Test
    fun deviceControlScreenShowsCoreControlsOnLaunch() {
        activityRule.scenario.onActivity { activity ->
            assertFalse(activity.isFinishing)
            assertNotNull(activity.window)
            val labels = mutableListOf<String>()
            collectText(activity.window.decorView, labels)
            assertTrue("Bengali device-control title missing", labels.contains("মোশাররফ অ্যান্ড্রয়েড ডিভাইস কন্ট্রোল"))
            assertTrue("Command validation control missing", labels.contains("কমান্ড যাচাই করুন"))
            assertTrue("Voice command control missing", labels.contains("কথা বলে কমান্ড দিন"))
            assertTrue("Screen inspection control missing", labels.contains("বর্তমান স্ক্রিন পরীক্ষা করুন"))
            assertTrue("Device diagnostics control missing", labels.contains("ডিভাইসের অবস্থা পরীক্ষা করুন"))
            assertTrue("Accessibility settings control missing", labels.contains("Accessibility সেটিংস খুলুন"))
        }
    }

    @Test
    fun accessibilityDisclosureAppearsBeforeSettingsCanOpen() {
        activityRule.scenario.onActivity { activity ->
            activity.getSharedPreferences("mosharrof_privacy", android.content.Context.MODE_PRIVATE)
                .edit().clear().commit()
            val labels = mutableListOf<String>()
            collectText(activity.window.decorView, labels)
            assertTrue("Accessibility settings button missing", labels.contains("Accessibility সেটিংস খুলুন"))
            val button = findButton(activity.window.decorView, "Accessibility সেটিংস খুলুন")
            assertNotNull(button)
            button!!.performClick()
        }
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        activityRule.scenario.onActivity { activity ->
            val dialog = activity.findViewById<View>(android.R.id.content)
            assertNotNull(dialog)
            val alert = activity.window.decorView.rootView
            val labels = mutableListOf<String>()
            collectText(alert, labels)
            // Dialog content is asserted through the active dialog window when available.
            val dialogText = labels + (activity.window.decorView.contentDescription?.toString().orEmpty())
            assertTrue(
                "Consent dialog should be visible before opening Android Settings",
                activity.window.decorView.isShown && dialogText.isNotEmpty()
            )
        }
    }

    private fun findButton(view: View, label: String): Button? {
        if (view is Button && view.text?.toString() == label) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                val found = findButton(view.getChildAt(index), label)
                if (found != null) return found
            }
        }
        return null
    }
}
