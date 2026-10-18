package com.mosharrof.agent.files

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PhotoCategoryTest {
    @Test fun photoCategoriesHaveDistinctBengaliFolderNames() {
        val labels = PhotoCategory.entries.map { it.folderLabel }
        assertEquals(PhotoCategory.entries.size, labels.distinct().size)
        assertTrue(labels.contains("স্ক্রিনশট"))
        assertTrue(labels.contains("ডকুমেন্ট"))
        assertTrue(labels.contains("প্রকৃতি"))
        assertTrue(labels.contains("অন্যান্য"))
    }

    @Test fun unknownSongTopicRemainsExplicitlyUnclassified() {
        assertEquals("বিষয় নির্ধারণ বাকি", SongTopic.UNKNOWN.bengaliLabel)
    }
}
