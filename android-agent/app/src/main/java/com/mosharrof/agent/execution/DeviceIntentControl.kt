package com.mosharrof.agent.execution

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.provider.AlarmClock
import android.provider.CalendarContract
import android.provider.CalendarContract.Events
import android.widget.TextView
import com.mosharrof.agent.planner.DeviceIntentCommand
import com.mosharrof.agent.planner.DeviceIntentCommandParser
import java.util.Calendar

/** Hands clock and calendar work to Android's own UI after showing a local preview. */
object DeviceIntentControl {
    fun handle(activity: Activity, rawCommand: String, status: TextView): Boolean {
        val command = DeviceIntentCommandParser.parse(rawCommand) ?: return false
        val intent = when (command) {
            is DeviceIntentCommand.SetTimer -> Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, command.seconds)
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                putExtra(AlarmClock.EXTRA_MESSAGE, "MOSHARROF timer")
            }
            is DeviceIntentCommand.SetAlarm -> Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, command.hour)
                putExtra(AlarmClock.EXTRA_MINUTES, command.minute)
                putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                putExtra(AlarmClock.EXTRA_MESSAGE, "MOSHARROF alarm")
            }
            is DeviceIntentCommand.CreateCalendarEvent -> {
                val start = Calendar.getInstance().apply {
                    add(Calendar.DAY_OF_YEAR, command.dayOffset)
                    set(Calendar.HOUR_OF_DAY, command.hour)
                    set(Calendar.MINUTE, command.minute)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }
                val end = (start.clone() as Calendar).apply { add(Calendar.HOUR_OF_DAY, 1) }
                Intent(Intent.ACTION_INSERT, Events.CONTENT_URI).apply {
                    putExtra(Events.TITLE, command.title)
                    putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start.timeInMillis)
                    putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end.timeInMillis)
                }
            }
            DeviceIntentCommand.OpenCalendar -> Intent(Intent.ACTION_VIEW, CalendarContract.CONTENT_URI)
        }
        val preview = when (command) {
            is DeviceIntentCommand.SetTimer -> "টাইমার: ${command.seconds} সেকেন্ড"
            is DeviceIntentCommand.SetAlarm -> "অ্যালার্ম: %02d:%02d".format(command.hour, command.minute)
            is DeviceIntentCommand.CreateCalendarEvent -> "ক্যালেন্ডার ইভেন্ট: ${command.title}"
            DeviceIntentCommand.OpenCalendar -> "ক্যালেন্ডার খুলবে"
        }
        AlertDialog.Builder(activity)
            .setTitle("MOSHARROF • কাজের অনুমতি")
            .setMessage("$preview\n\nAndroid-এর Clock/Calendar UI খুলবে। সেখানে প্রয়োজন হলে আবার নিশ্চিত করুন।")
            .setNegativeButton("বাতিল", null)
            .setPositiveButton("চালিয়ে যান") { _, _ ->
                try {
                    activity.startActivity(intent)
                    status.text = "Android-এর Clock/Calendar UI খোলা হয়েছে। কাজটি সেখানে যাচাই করুন।"
                } catch (_: Exception) {
                    status.text = "এই ডিভাইসে উপযুক্ত Clock/Calendar অ্যাপ পাওয়া যায়নি।"
                }
            }
            .show()
        return true
    }
}
