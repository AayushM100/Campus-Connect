package com.sahiljadhav.campusconnect.data.model

data class TrayItem(
    val item: MenuItem,
    val quantity: Int = 1
) {
    val totalCost: Double
        get() = item.priceValue * quantity

    val totalCostFormatted: String
        get() {
            val total = totalCost
            return if (total % 1.0 == 0.0) "₹${total.toInt()}" else "₹${String.format("%.2f", total)}"
        }
}
