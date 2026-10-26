package com.sahiljadhav.campusconnect.data.model

import com.google.gson.annotations.SerializedName

data class Canteen(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String
) {
    val displayName: String
        get() = when (id.lowercase()) {
            "cafeteria" -> "Campus Cafeteria"
            "timeless" -> "Cafe Timeless"
            "nescafe" -> "Nescafe Hub"
            else -> name
        }

    val subtitle: String
        get() = when (id.lowercase()) {
            "cafeteria" -> "Main Hall • Meals & Thalis"
            "timeless" -> "Snack Bar • Burgers & Shakes"
            "nescafe" -> "Kiosk • Coffee & Maggi"
            else -> "Campus Food Spot"
        }

    val iconEmoji: String
        get() = when (id.lowercase()) {
            "cafeteria" -> "🍛"
            "timeless" -> "🍔"
            "nescafe" -> "☕"
            else -> "🍽️"
        }
}
