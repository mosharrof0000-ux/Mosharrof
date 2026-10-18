package com.mosharrof.agent

import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
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

    private fun waitForText(text: String): UiObject2? =
        device.wait(Until.findObject(By.text(text)), 10_000)

    private fun assertTextVisible(text: String) {
        val element = waitForText(text)
        assertNotNull("Expected visible text: $text", element)
    }

    @Test
    fun commandControlsAreVisibleOnLaunch() {
        device.waitForIdle()
        assertTextVisible("মোশাররফ অটোনোমাস এজেন্ট")
        val scroll = UiScrollable(UiSelector().scrollable(true)).apply {
            setAsVerticalList()
        }
        listOf(
            "কমান্ড যাচাই করুন",
            "কথা বলে কমান্ড দিন",
            "ফলাফল পড়ে শোনান",
            "কণ্ঠ থামান",
            "কাজ বাতিল করুন",
            "ডিভাইসের অবস্থা পরীক্ষা করুন"
        ).forEach { text ->
            assertTrue("Expected to find text while scrolling: $text", scroll.scrollTextIntoView(text))
            assertTextVisible(text)
        }
    }

    @Test
    fun accessibilityDisclosureAppearsBeforeSettingsCanOpen() {
        activityRule.scenario.onActivity { activity ->
            activity.getSharedPreferences("mosharrof_privacy", android.content.Context.MODE_PRIVATE)
                .edit().clear().commit()
        }
        device.waitForIdle()
        val settingsButton = waitForText("Accessibility সেটিংস খুলুন")
        assertNotNull("Accessibility settings button should be visible", settingsButton)
        settingsButton!!.click()

        assertTextVisible("স্ক্রিন নিয়ন্ত্রণের অনুমতি")
        assertTextVisible("বুঝেছি, Settings খুলুন")
        val dismiss = waitForText("এখন নয়")
        assertNotNull("Consent dialog must offer a safe dismissal action", dismiss)
        dismiss!!.click()
        device.waitForIdle()
    }
}
