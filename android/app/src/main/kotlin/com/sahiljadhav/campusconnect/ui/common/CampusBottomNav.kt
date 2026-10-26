package com.sahiljadhav.campusconnect.ui.common

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.ShoppingBag
import androidx.compose.material.icons.rounded.Restaurant
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.sahiljadhav.campusconnect.ui.theme.BrandOrange

enum class CampusTab(
    val title: String,
    val icon: ImageVector
) {
    HOME("Home", Icons.Rounded.Home),
    CANTEEN("Canteen", Icons.Rounded.Restaurant),
    LOST_FOUND("Lost & Found", Icons.Rounded.Search),
    TRAY("Tray", Icons.Rounded.ShoppingBag)
}

@Composable
fun CampusBottomNav(
    selectedTab: CampusTab,
    onTabSelected: (CampusTab) -> Unit,
    trayCount: Int = 0
) {
    NavigationBar(
        containerColor = MaterialTheme.colorScheme.surface,
        tonalElevation = 6.dp
    ) {
        CampusTab.entries.forEach { tab ->
            val isSelected = selectedTab == tab
            NavigationBarItem(
                selected = isSelected,
                onClick = { onTabSelected(tab) },
                icon = {
                    if (tab == CampusTab.TRAY && trayCount > 0) {
                        BadgedBox(
                            badge = {
                                Badge(
                                    containerColor = BrandOrange,
                                    contentColor = MaterialTheme.colorScheme.surface
                                ) {
                                    Text(text = trayCount.toString())
                                }
                            }
                        ) {
                            Icon(imageVector = tab.icon, contentDescription = tab.title)
                        }
                    } else {
                        Icon(imageVector = tab.icon, contentDescription = tab.title)
                    }
                },
                label = {
                    Text(
                        text = tab.title,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = BrandOrange,
                    selectedTextColor = BrandOrange,
                    indicatorColor = BrandOrange.copy(alpha = 0.15f),
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            )
        }
    }
}
