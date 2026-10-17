package com.mosharrof.agent.accessibility

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import com.mosharrof.agent.MainActivity
import kotlin.math.abs

/** User-enabled, draggable Accessibility overlay. It never performs app actions itself. */
internal class FloatingAgentControl(
    private val service: AccessibilityService,
    private val onDisable: () -> Unit
) {
    private val windowManager = service.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private val prefs = service.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val touchSlop = ViewConfiguration.get(service).scaledTouchSlop
    private var root: LinearLayout? = null
    private var mic: TextView? = null
    private var expanded = false
    private var downX = 0f
    private var downY = 0f
    private var startX = 0
    private var startY = 0
    private var dragging = false
    private val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
        PixelFormat.TRANSLUCENT
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        x = prefs.getInt(KEY_X, 0)
        y = prefs.getInt(KEY_Y, service.resources.displayMetrics.heightPixels / 3)
    }

    fun show() {
        if (root != null) return
        val container = LinearLayout(service).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(6), dp(4), dp(6), dp(4))
            background = roundedBackground()
        }
        val microphone = TextView(service).apply {
            text = "🎙"
            textSize = 22f
            setPadding(dp(10), dp(8), dp(10), dp(8))
            contentDescription = "MOSHARROF voice assistant; long press to expand"
            setOnClickListener { openVoiceAssistant() }
            setOnLongClickListener {
                setExpanded(!expanded)
                true
            }
            setOnTouchListener(::handleDrag)
        }
        container.addView(microphone)
        root = container
        mic = microphone
        setExpanded(false)
        runCatching { windowManager.addView(container, params) }
            .onFailure { root = null; mic = null }
    }

    fun hide() {
        root?.let { view -> runCatching { windowManager.removeView(view) } }
        root = null
        mic = null
    }

    private fun setExpanded(value: Boolean) {
        expanded = value
        val container = root ?: return
        val microphone = mic ?: return
        microphone.text = if (value) "🎙 MOSHARROF" else "🎙"
        microphone.contentDescription = if (value) "Tap to give a voice command; long press to collapse" else "Tap to give a voice command; long press to expand"
        container.removeViews(1, container.childCount - 1)
        if (value) {
            container.addView(TextView(service).apply {
                text = "×"
                textSize = 22f
                setPadding(dp(12), dp(8), dp(12), dp(8))
                contentDescription = "ভাসমান সহকারী বন্ধ করুন"
                setOnClickListener { onDisable() }
            })
        }
        runCatching { windowManager.updateViewLayout(container, params) }
    }

    private fun handleDrag(view: View, event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.rawX
                downY = event.rawY
                startX = params.x
                startY = params.y
                dragging = false
                return false
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.rawX - downX
                val dy = event.rawY - downY
                if (!dragging && (abs(dx) > touchSlop || abs(dy) > touchSlop)) dragging = true
                if (dragging) {
                    params.x = (startX + dx.toInt()).coerceAtLeast(0)
                    params.y = (startY + dy.toInt()).coerceAtLeast(0)
                    root?.let { container -> runCatching { windowManager.updateViewLayout(container, params) } }
                    return true
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (dragging) {
                    val screenWidth = service.resources.displayMetrics.widthPixels
                    params.x = if (params.x + view.width / 2 < screenWidth / 2) 0
                        else (screenWidth - (root?.width ?: view.width)).coerceAtLeast(0)
                    prefs.edit().putInt(KEY_X, params.x).putInt(KEY_Y, params.y).apply()
                    runCatching { windowManager.updateViewLayout(root, params) }
                    dragging = false
                    return true
                }
            }
        }
        return false
    }

    private fun openVoiceAssistant() {
        val intent = Intent(service, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra(MainActivity.EXTRA_START_VOICE, true)
        }
        runCatching { service.startActivity(intent) }
    }

    private fun roundedBackground() = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(28).toFloat()
        setColor(Color.rgb(42, 48, 65))
        setStroke(dp(1), Color.WHITE)
    }

    private fun dp(value: Int): Int = (value * service.resources.displayMetrics.density).toInt()

    companion object {
        const val PREFS = "mosharrof_agent_controls"
        const val KEY_ENABLED = "floating_control_enabled"
        private const val KEY_X = "floating_control_x"
        private const val KEY_Y = "floating_control_y"

        fun isEnabled(context: Context): Boolean =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)
    }
}
