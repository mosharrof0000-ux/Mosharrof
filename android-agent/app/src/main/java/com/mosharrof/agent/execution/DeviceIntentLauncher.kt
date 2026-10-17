package com.mosharrof.agent.execution

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.mosharrof.agent.planner.DeviceIntentRequest
import com.mosharrof.agent.planner.TaskPlan

/** Uses granted telephony capabilities after the task confirmation; otherwise opens Android-owned drafts. */
class DeviceIntentLauncher(private val context: Context) {
    fun launch(plan: TaskPlan.SystemIntent): String {
        val request = DeviceIntentRequest(plan.kind, plan.target, plan.text, plan.seconds)
        val number = request.target.filter { it.isDigit() || it == '+' }
        val callGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        val smsGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED
        val intent = when (request.kind) {
            DeviceIntentRequest.Kind.DIAL ->
                Intent(if (callGranted) Intent.ACTION_CALL else Intent.ACTION_DIAL, Uri.parse("tel:$number"))
            DeviceIntentRequest.Kind.COMPOSE_SMS ->
                Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:$number")).apply { putExtra("sms_body", request.text) }
            DeviceIntentRequest.Kind.SET_TIMER -> Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, request.seconds)
                putExtra(AlarmClock.EXTRA_MESSAGE, "MOSHARROF timer")
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            }
            DeviceIntentRequest.Kind.CREATE_CALENDAR_EVENT ->
                Intent(Intent.ACTION_INSERT, CalendarContract.Events.CONTENT_URI).apply {
                    putExtra(CalendarContract.Events.TITLE, request.text)
                }
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            when (request.kind) {
                DeviceIntentRequest.Kind.DIAL -> {
                    context.startActivity(intent)
                    if (callGranted) "কলের অনুরোধ Android গ্রহণ করেছে; ফোন/নেটওয়ার্কের অবস্থা অনুযায়ী ফল যাচাই করুন।"
                    else "Dialer খোলা হয়েছে। CALL_PHONE অনুমতি না থাকায় নম্বরটি নিজে কল করুন।"
                }
                DeviceIntentRequest.Kind.COMPOSE_SMS -> {
                    if (smsGranted) {
                        val sms = SmsManager.getDefault()
                        val parts = sms.divideMessage(request.text)
                        if (parts.size > 1) sms.sendMultipartTextMessage(number, null, parts, null, null)
                        else sms.sendTextMessage(number, null, request.text, null, null)
                        "SMS Android-এর SMS service-এ পাঠানোর জন্য জমা হয়েছে; ডেলিভারি নিশ্চিত নয়।"
                    } else {
                        context.startActivity(intent)
                        "SMS খসড়া খোলা হয়েছে। SEND_SMS অনুমতি না থাকায় বার্তাটি যাচাই করে নিজে পাঠান।"
                    }
                }
                DeviceIntentRequest.Kind.SET_TIMER -> {
                    context.startActivity(intent)
                    "Android Clock-এ টাইমার তৈরির অনুরোধ পাঠানো হয়েছে; ফলাফল Clock-এ যাচাই করুন।"
                }
                DeviceIntentRequest.Kind.CREATE_CALENDAR_EVENT -> {
                    context.startActivity(intent)
                    "Calendar ইভেন্ট খসড়া খোলা হয়েছে; সময়/বিস্তারিত যাচাই করে সংরক্ষণ করুন।"
                }
            }
        } catch (_: ActivityNotFoundException) {
            "এই কাজের জন্য উপযুক্ত Dialer/SMS/Clock/Calendar অ্যাপ পাওয়া যায়নি।"
        } catch (_: SecurityException) {
            "Android অনুমতি/নিরাপত্তার কারণে কাজটি প্রত্যাখ্যান করেছে; সেটিংসে অনুমতি যাচাই করুন।"
        } catch (error: Exception) {
            "কাজটি সম্পন্ন হয়েছে বলে নিশ্চিত করা যায়নি: ${error.message ?: "অজানা ত্রুটি"}"
        }
    }
}
