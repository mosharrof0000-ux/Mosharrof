package com.mosharrof.agent

import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.scrollTo
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withText
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivitySmokeTest {
    @get:Rule
    val activityRule = ActivityScenarioRule(MainActivity::class.java)

    @Test
    fun commandControlsAreVisibleOnLaunch() {
        onView(withText("মোশাররফ অটোনোমাস এজেন্ট")).check(matches(isDisplayed()))
        onView(withText("কমান্ড যাচাই করুন")).perform(scrollTo()).check(matches(isDisplayed()))
        onView(withText("কথা বলে কমান্ড দিন")).perform(scrollTo()).check(matches(isDisplayed()))
        onView(withText("ফলাফল পড়ে শোনান")).perform(scrollTo()).check(matches(isDisplayed()))
        onView(withText("কণ্ঠ থামান")).perform(scrollTo()).check(matches(isDisplayed()))
        onView(withText("কাজ বাতিল করুন")).perform(scrollTo()).check(matches(isDisplayed()))
        onView(withText("ডিভাইসের অবস্থা পরীক্ষা করুন")).perform(scrollTo()).check(matches(isDisplayed()))
    }
    @Test
    fun accessibilityDisclosureAppearsBeforeSettingsCanOpen() {
        activityRule.scenario.onActivity { activity ->
            activity.getSharedPreferences("mosharrof_privacy", android.content.Context.MODE_PRIVATE)
                .edit().clear().commit()
        }
        onView(withText("Accessibility সেটিংস খুলুন")).perform(scrollTo(), click())
        onView(withText("স্ক্রিন নিয়ন্ত্রণের অনুমতি")).check(matches(isDisplayed()))
        onView(withText("বুঝেছি, Settings খুলুন")).check(matches(isDisplayed()))
        onView(withText("এখন নয়")).check(matches(isDisplayed()))
    }

}
