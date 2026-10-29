package com.sahiljadhav.campusconnect.data.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LostFoundItemTest {

    @Test
    fun testLostFoundStatusAndFallbackIcon() {
        val wallet = LostFoundItem(
            serialNumber = 10,
            itemName = "Black Leather Wallet",
            location = "Library 1st Floor",
            description = "Contains campus card",
            status = "lost"
        )
        assertTrue(wallet.isLost)
        assertEquals("LOST", wallet.displayStatus)
        assertEquals("👛", wallet.fallbackIcon)
        assertEquals("Campus Student", wallet.displayReporter)
    }

    @Test
    fun testResolvedImageUrl() {
        val dataUriItem = LostFoundItem(
            serialNumber = 11,
            itemName = "Roller",
            location = "Lab",
            description = "Youva roller",
            status = "found",
            image = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
        )
        assertEquals("data:image/jpeg;base64,/9j/4AAQSkZJRg==", dataUriItem.resolvedImageUrl)

        val relativeItem = LostFoundItem(
            serialNumber = 12,
            itemName = "pen",
            location = "Room 302",
            description = "Trimax",
            status = "lost",
            image = "/lost_and_found/uploads/items/trimax.jpeg"
        )
        assertEquals(
            "https://campus-connect-4n2t.onrender.com/uploads/items/trimax.jpeg",
            relativeItem.resolvedImageUrl
        )
    }
}
