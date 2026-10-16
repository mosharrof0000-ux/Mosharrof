package com.mosharrof.agent.execution

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.AlarmClock
import android.provider.CalendarContract
import com.mosharrof.agent.planner.DeviceIntentRequest
import com.mosharrof.agent.planner.TaskPlan

/** Delegates sensitive actions to Android-owned apps; never places a call or sends a message directly. */
class DeviceIntentLauncher(private val context: Context) {
    fun launch(plan: TaskPlan.SystemIntent): String {
        val request = DeviceIntentRequest(plan.kind, plan.target, plan.text, plan.seconds)
        val intent = when (request.kind) {
            DeviceIntentRequest.Kind.DIAL -> Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(request.target)}"))
            DeviceIntentRequest.Kind.COMPOSE_SMS -> Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:${Uri.encode(request.target)}")).apply {
                putExtra("sms_body", request.text)
            }
            DeviceIntentRequest.Kind.SET_TIMER -> Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, request.seconds)
                putExtra(AlarmClock.EXTRA_MESSAGE, "MOSHARROF timer")
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            }
            DeviceIntentRequest.Kind.CREATE_CALENDAR_EVENT -> Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI).apply {
                putExtra(CalendarContract.Events.TITLE, request.text)
            }
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            when (request.kind) {
                DeviceIntentRequest.Kind.DIAL -> "ডায়ালার খোলা হয়েছে। কল করতে ফোন অ্যাপে নিজে নিশ্চিত করুন।"
                DeviceIntentRequest.Kind.COMPOSE_SMS -> "SMS খসড়া খোলা হয়েছে। প্রাপক ও লেখা যাচাই করে নিজে পাঠান।"
                DeviceIntentRequest.Kind.SET_TIMER -> "Android Clock-এ টাইমার তৈরির অনুরোধ পাঠানো হয়েছে; ফলাফল Clock-এ যাচাই করুন।"
                DeviceIntentRequest.Kind.CREATE_CALENDAR_EVENT -> "Calendar ইভেন্ট খসড়া খোলা হয়েছে; সময়/বিস্তারিত যাচাই করে সংরক্ষণ করুন।"
            }
        } catch (_: ActivityNotFoundException) {
            "এই কাজের জন্য উপযুক্ত Dialer/SMS/Clock/Calendar অ্যাপ পাওয়া যায়নি।"
        } catch (_: SecurityException) {
            "Android নিরাপত্তার কারণে এই intent প্রত্যাখ্যান করেছে; কোনো কাজ নিশ্চিত করা হয়নি।"
        }
    }
}
