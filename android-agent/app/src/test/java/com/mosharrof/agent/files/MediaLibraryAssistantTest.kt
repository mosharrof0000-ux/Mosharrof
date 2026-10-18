package com.mosharrof.agent.files

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaLibraryAssistantTest {
    @Test fun classifiesCommonMediaTypes() {
        assertEquals(MediaKind.IMAGE, MediaLibraryAssistant.classify("ছবি.JPG"))
        assertEquals(MediaKind.AUDIO, MediaLibraryAssistant.classify("baul-song.mp3"))
        assertEquals(MediaKind.VIDEO, MediaLibraryAssistant.classify("clip.mp4"))
        assertEquals(MediaKind.ANDROID_PACKAGE, MediaLibraryAssistant.classify("installer.apk"))
    }

    @Test fun oneSongCanBelongToSeveralThemes() {
        val draft = MediaLibraryAssistant.draftSongTopics("দেহতত্ত্ব আর গুরু মুর্শিদ আত্মা")
        assertTrue(draft.topics.contains(SongTopic.BODY_PHILOSOPHY))
        assertTrue(draft.topics.contains(SongTopic.GURU_PHILOSOPHY))
        assertTrue(draft.topics.contains(SongTopic.SOUL_PHILOSOPHY))
        assertTrue(draft.needsReview)
    }

    @Test fun groupsSongsIntoEachRelevantTopic() {
        val song = MediaRecord("content://song/1", "Song.mp3", MediaKind.AUDIO, 10, topics=setOf(SongTopic.GURU_PHILOSOPHY, SongTopic.SOUL_PHILOSOPHY))
        val groups = MediaLibraryAssistant.groupSongsByTopic(listOf(song))
        assertTrue(groups[SongTopic.GURU_PHILOSOPHY]?.contains(song) == true)
        assertTrue(groups[SongTopic.SOUL_PHILOSOPHY]?.contains(song) == true)
    }

    @Test fun usesApprovedBengaliTitleWithoutChangingOriginalFileName() {
        val song = MediaRecord("content://song/1", "Guru Song.mp3", MediaKind.AUDIO, 10, bengaliTitle="গুরু গান")
        assertEquals("গুরু গান", MediaLibraryAssistant.displayTitle(song))
        assertEquals("Guru Song.mp3", song.fileName)
    }
}
