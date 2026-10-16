package com.mosharrof.agent.notifications

import android.app.Notification
import android.content.ComponentName
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Optional, user-enabled notification reader. Data remains in memory on this device. */
class MosharrofNotificationListenerService : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null || sbn.packageName == packageName) return
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
        if (title.isBlank() && text.isBlank()) return
        synchronized(lock) {
            recent.removeAll { it.key == sbn.key }
            recent.add(0, NotificationPreview(
                sbn.key,
                sbn.packageName,
                title.take(MAX_FIELD),
                text.take(MAX_FIELD),
                sbn.postTime
            ))
            while (recent.size > MAX_ITEMS) recent.removeAt(recent.lastIndex)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        if (sbn != null) synchronized(lock) { recent.removeAll { it.key == sbn.key } }
    }

    override fun onListenerDisconnected() {
        clearRecent()
        super.onListenerDisconnected()
        NotificationListenerService.requestRebind(ComponentName(this, javaClass))
    }

    override fun onDestroy() {
        clearRecent()
        super.onDestroy()
    }

    companion object {
        private const val MAX_ITEMS = 20
        private const val MAX_FIELD = 400
        private val lock = Any()
        private val recent = mutableListOf<NotificationPreview>()

        fun snapshot(): String = synchronized(lock) {
            if (recent.isEmpty()) return "এখনো কোনো নোটিফিকেশন পড়া হয়নি; Notification access চালু করুন এবং নতুন নোটিফিকেশন আসতে দিন।"
            recent.joinToString("\n\n") {
                val time = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(it.postTime))
                "$time • ${it.packageName}\n${it.title}\n${it.text}".trim()
            }
        }

        fun clearLocalSnapshot() = synchronized(lock) { recent.clear() }

        private fun clearRecent() = clearLocalSnapshot()
    }
}

private data class NotificationPreview(
    val key: String,
    val packageName: String,
    val title: String,
    val text: String,
    val postTime: Long
)
