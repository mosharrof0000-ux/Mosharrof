package com.mosharrof.agent.files

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaFolderPlannerTest {
    @Test fun proposesSeparatePhotoVideoAndTopicFolders() {
        val records = listOf(
            MediaRecord("u1", "a.jpg", MediaKind.IMAGE, 1),
            MediaRecord("u2", "b.mp4", MediaKind.VIDEO, 1),
            MediaRecord("u3", "song.mp3", MediaKind.AUDIO, 1, topics=setOf(SongTopic.BODY_PHILOSOPHY, SongTopic.GURU_PHILOSOPHY))
        )
        val plan = MediaFolderPlanner.plan(records)
        assertEquals("ছবি", plan[0].destinationFolder)
        assertEquals("ভিডিও", plan[1].destinationFolder)
        assertTrue(plan[2].destinationFolder.contains("দেহতত্ত্ব"))
        assertTrue(plan[2].destinationFolder.contains("গুরুতত্ত্ব"))
    }

    @Test fun plannerDoesNotSuggestMovingUnknownFiles() {
        assertTrue(MediaFolderPlanner.plan(listOf(MediaRecord("u", "x.bin", MediaKind.OTHER, 1))).isEmpty())
    }
}
