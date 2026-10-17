package com.mosharrof.agent.permissions

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/** Transparent capability hub: Android itself remains the permission authority. */
object CapabilityAccessControl {
    private data class Route(val label: String, val description: String, val intent: (Activity) -> Intent)

    fun addTo(activity: Activity, layout: LinearLayout, status: TextView) {
        layout.addView(TextView(activity).apply {
            text = "ডিভাইস ক্ষমতা ও অনুমতি"
            textSize = 20f
        })
        layout.addView(TextView(activity).apply {
            text = "প্রতিটি ক্ষমতা আলাদাভাবে চালু করুন। Android যে অনুমতি দেয় না, অ্যাপ সেটি নিজে থেকে নিতে বা OS-এর নিরাপত্তা এড়াতে পারবে না।"
            textSize = 14f
        })
        routes(activity).forEach { route ->
            layout.addView(Button(activity).apply {
                text = route.label
                setOnClickListener {
                    status.text = route.description
                    try { activity.startActivity(route.intent(activity)) }
                    catch (_: Exception) { status.text = "এই Android/OEM-এ সেটিংস পৃষ্ঠা পাওয়া যায়নি; Android Settings থেকে ম্যানুয়ালি খুলুন।" }
                }
            })
        }
    }

    private fun routes(activity: Activity): List<Route> = listOf(
        Route("Accessibility control চালু/পর্যালোচনা", "UI পড়া, নির্দিষ্ট control-এ কাজ ও system navigation-এর জন্য ব্যবহারকারীর অনুমতি প্রয়োজন।") {
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        },
        Route("MOSHARROF অ্যাপের অনুমতি", "Microphone ও অন্যান্য runtime permission Android-এর App info থেকে পর্যালোচনা করুন।") {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${activity.packageName}"))
        },
        Route("Notification access সেটিংস", "Notification পড়ার ক্ষমতা যোগ করতে ভবিষ্যতে NotificationListenerService ও disclosure UI বাস্তবায়ন করতে হবে; এখানে শুধু Android-এর সেটিংস খোলা হচ্ছে।") {
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        },
        Route("Usage access সেটিংস", "অ্যাপ ব্যবহারের পরিসংখ্যানের জন্য আলাদা Usage Access integration ও ব্যবহারকারীর অনুমতি দরকার।") {
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
        },
        Route("Battery optimization সেটিংস", "ব্যাকগ্রাউন্ড নির্ভরযোগ্যতার সীমা দেখুন; battery optimization বন্ধ করা এই অ্যাপের জন্য বাধ্যতামূলক নয়।") {
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        },
        Route("Wi-Fi সেটিংস", "Wi-Fi পরিবর্তন Android Settings-এ নিজে নিশ্চিত করুন।") {
            Intent(Settings.ACTION_WIFI_SETTINGS)
        },
        Route("Bluetooth সেটিংস", "Bluetooth পরিবর্তন Android Settings-এ নিজে নিশ্চিত করুন।") {
            Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
        },
        Route("Location সেটিংস", "Location access ও device location Android Settings-এ পর্যালোচনা করুন।") {
            Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        }
    )
}
