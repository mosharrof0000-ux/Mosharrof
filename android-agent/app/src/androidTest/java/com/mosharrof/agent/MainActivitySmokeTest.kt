package com.mosharrof.agent

import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.assertion.ViewAssertions.matches
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
        onView(withText("কমান্ড যাচাই করুন")).check(matches(isDisplayed()))
        onView(withText("কথা বলে কমান্ড দিন")).check(matches(isDisplayed()))
        onView(withText("ফলাফল পড়ে শোনান")).check(matches(isDisplayed()))
        onView(withText("কণ্ঠ থামান")).check(matches(isDisplayed()))
        onView(withText("কাজ বাতিল করুন")).check(matches(isDisplayed()))
        onView(withText("ভাসমান MOSHARROF বোতাম চালু করুন")).check(matches(isDisplayed()))
    }
}
