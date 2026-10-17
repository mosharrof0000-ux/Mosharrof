package com.mosharrof.agent.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/** Keeps a bounded, in-memory notification snapshot only; no notification is persisted or uploaded. */
class AgentNotificationListenerService : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null || sbn.packageName == packageName) return
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().take(MAX_FIELD)
        val text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val item = AgentNotification(sbn.packageName, title, text.take(MAX_FIELD), sbn.postTime)
        synchronized(lock) {
            recent.removeAll { it.key == item.key }
            recent.add(0, item)
            while (recent.size > MAX_ITEMS) recent.removeAt(recent.lastIndex)
        }
    }

    companion object {
        private const val MAX_ITEMS = 30
        private const val MAX_FIELD = 240
        private val lock = Any()
        private val recent = mutableListOf<AgentNotification>()

        fun snapshot(): List<AgentNotification> = synchronized(lock) { recent.toList() }
        fun clearLocalSnapshot() = synchronized(lock) { recent.clear() }
    }
}

data class AgentNotification(
    val packageName: String,
    val title: String,
    val text: String,
    val postedAtMillis: Long,
    val key: String = "$packageName:$postedAtMillis:$title"
)
