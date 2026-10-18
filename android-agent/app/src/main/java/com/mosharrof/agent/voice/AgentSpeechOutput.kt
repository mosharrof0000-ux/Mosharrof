package com.mosharrof.agent.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * Small, lifecycle-bound speech output adapter. It speaks only text explicitly passed by the UI;
 * it never reads arbitrary screen contents or records audio.
 */
class AgentSpeechOutput(
    context: Context,
    private val onState: (String) -> Unit
) : AutoCloseable {
    private var ready = false
    private var closed = false
    private val engine = TextToSpeech(context.applicationContext) { result ->
        if (closed) return@TextToSpeech
        ready = result == TextToSpeech.SUCCESS
        if (ready) {
            val bengali = engineLanguage(Locale.forLanguageTag("bn-BD"))
            if (!bengali) engineLanguage(Locale.getDefault())
            onState(if (bengali) "বাংলা কণ্ঠস্বর প্রস্তুত।" else "কণ্ঠস্বর প্রস্তুত; বাংলা কণ্ঠ নাও থাকতে পারে।")
        } else {
            onState("এই ডিভাইসে Text-to-Speech চালু করা যায়নি।")
        }
    }

    init {
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                onState("ফলাফল পড়ে শোনানো হচ্ছে…")
            }

            override fun onDone(utteranceId: String?) {
                onState("পড়ে শোনানো শেষ।")
            }

            @Deprecated("Deprecated by Android")
            override fun onError(utteranceId: String?) {
                onState("কণ্ঠে পড়তে সমস্যা হয়েছে।")
            }

            override fun onError(utteranceId: String?, errorCode: Int) {
                onState("কণ্ঠে পড়তে সমস্যা হয়েছে (কোড $errorCode)।")
            }
        })
    }

    fun speak(text: String) {
        val safeText = text.trim().take(MAX_SPEECH_LENGTH)
        if (safeText.isBlank()) {
            onState("পড়ে শোনানোর মতো কোনো ফলাফল নেই।")
            return
        }
        if (!ready || closed) {
            onState("Text-to-Speech এখনও প্রস্তুত নয়।")
            return
        }
        val result = engine.speak(safeText, TextToSpeech.QUEUE_FLUSH, null, UTTERANCE_ID)
        if (result == TextToSpeech.ERROR) onState("কণ্ঠে পড়া শুরু করা যায়নি।")
    }

    fun stop() {
        if (!closed) engine.stop()
    }

    private fun engineLanguage(locale: Locale): Boolean {
        val status = engine.setLanguage(locale)
        return status != TextToSpeech.LANG_MISSING_DATA &&
            status != TextToSpeech.LANG_NOT_SUPPORTED
    }

    override fun close() {
        if (closed) return
        closed = true
        engine.stop()
        engine.shutdown()
    }

    companion object {
        private const val MAX_SPEECH_LENGTH = 500
        private const val UTTERANCE_ID = "mosharrof-agent-status"
    }
}
