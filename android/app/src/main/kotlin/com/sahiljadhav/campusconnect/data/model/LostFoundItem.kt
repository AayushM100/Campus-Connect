package com.sahiljadhav.campusconnect.data.model

import com.google.gson.annotations.SerializedName

data class LostFoundItem(
    @SerializedName("serial_number") val serialNumber: Long,
    @SerializedName("roll_number") val rollNumber: String? = null,
    @SerializedName("item_name") val itemName: String,
    @SerializedName("location") val location: String,
    @SerializedName("description") val description: String,
    @SerializedName("status") val status: String,
    @SerializedName("person_name") val personName: String? = null,
    @SerializedName("contact_number") val contactNumber: String? = null,
    @SerializedName("image") val image: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
) {
    val isLost: Boolean
        get() = status.equals("lost", ignoreCase = true)

    val isFound: Boolean
        get() = !isLost

    val displayStatus: String
        get() = if (isLost) "LOST" else "FOUND"

    val displayReporter: String
        get() = if (!personName.isNullOrBlank() && personName != "N/A") personName else "Campus Student"

    val displayRollNumber: String
        get() = if (!rollNumber.isNullOrBlank() && rollNumber != "N/A") rollNumber else "Not Specified"

    val displayContact: String?
        get() = if (!contactNumber.isNullOrBlank() && contactNumber != "N/A") contactNumber else null

    val resolvedImageUrl: String?
        get() {
            val img = image?.trim() ?: return null
            if (img.isEmpty()) return null
            if (img.startsWith("data:") || img.startsWith("http://") || img.startsWith("https://")) {
                return img
            }
            val filename = img.replace("\\", "/").substringAfterLast("/")
            if (filename.isNotEmpty()) {
                return "https://campus-connect-4n2t.onrender.com/uploads/items/$filename"
            }
            return null
        }

    val fallbackIcon: String
        get() {
            val name = itemName.lowercase()
            return when {
                name.contains("wallet") || name.contains("purse") -> "👛"
                name.contains("bag") || name.contains("backpack") || name.contains("pouch") -> "🎒"
                name.contains("id") || name.contains("card") -> "🪪"
                name.contains("phone") || name.contains("mobile") -> "📱"
                name.contains("key") -> "🔑"
                name.contains("bottle") -> "🍶"
                name.contains("spectacles") || name.contains("specs") || name.contains("glass") -> "👓"
                name.contains("calculator") -> "🧮"
                name.contains("charger") || name.contains("usb") || name.contains("cable") -> "🔌"
                name.contains("earphone") || name.contains("airpod") || name.contains("headphone") -> "🎧"
                name.contains("book") || name.contains("notebook") || name.contains("file") || name.contains("journal") -> "📚"
                name.contains("umbrella") -> "☂️"
                name.contains("pen") || name.contains("geometry") -> "✏️"
                else -> if (isLost) "🔍" else "📦"
            }
        }
}
