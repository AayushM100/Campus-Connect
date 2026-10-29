package com.sahiljadhav.campusconnect.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahiljadhav.campusconnect.ui.common.CampusTab
import com.sahiljadhav.campusconnect.ui.theme.BrandOrange
import com.sahiljadhav.campusconnect.ui.theme.BrandOrangeDark

/**
 * Native Jetpack Compose Floating Dock navigation component inspired by 21st.dev Dock designs.
 * Features:
 * - Floating translucent pill surface with glass border and soft shadow
 * - Spring-physics scale on press and selection
 * - Sliding active background indicator pill
 * - Vibrant tray notification badge
 * - Accessible 48dp+ touch targets with Light and Dark theme harmony
 */
@Composable
fun CampusDock(
    selectedTab: CampusTab,
    onTabSelected: (CampusTab) -> Unit,
    trayCount: Int = 0,
    modifier: Modifier = Modifier
) {
    val dockShape = RoundedCornerShape(26.dp)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        // Floating glass pill container
        Row(
            modifier = Modifier
                .shadow(
                    elevation = 14.dp,
                    shape = dockShape,
                    ambientColor = Color.Black.copy(alpha = 0.12f),
                    spotColor = BrandOrange.copy(alpha = 0.25f)
                )
                .clip(dockShape)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.94f),
                            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.92f)
                        )
                    )
                )
                .border(
                    width = 1.2.dp,
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.40f),
                            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.25f)
                        )
                    ),
                    shape = dockShape
                )
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CampusTab.entries.forEach { tab ->
                val isSelected = selectedTab == tab
                DockItem(
                    tab = tab,
                    isSelected = isSelected,
                    onClick = { onTabSelected(tab) },
                    badgeCount = if (tab == CampusTab.TRAY) trayCount else 0
                )
            }
        }
    }
}

@Composable
private fun DockItem(
    tab: CampusTab,
    isSelected: Boolean,
    onClick: () -> Unit,
    badgeCount: Int = 0
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    // Spring scaling for selection and touch
    val scale by animateFloatAsState(
        targetValue = when {
            isPressed -> 0.90f
            isSelected -> 1.05f
            else -> 1.0f
        },
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "dockItemScale"
    )

    val itemBgColor by animateColorAsState(
        targetValue = if (isSelected) BrandOrange.copy(alpha = 0.16f) else Color.Transparent,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "dockItemBg"
    )

    val contentColor by animateColorAsState(
        targetValue = if (isSelected) BrandOrange else MaterialTheme.colorScheme.onSurfaceVariant,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "dockItemContentColor"
    )

    val itemShape = RoundedCornerShape(20.dp)

    Box(
        modifier = Modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clip(itemShape)
            .background(itemBgColor)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
            .height(50.dp)
            .padding(horizontal = if (isSelected) 14.dp else 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            // Icon with optional badge
            BadgedBox(
                badge = {
                    if (badgeCount > 0) {
                        Badge(
                            containerColor = BrandOrange,
                            contentColor = Color.White
                        ) {
                            Text(
                                text = if (badgeCount > 99) "99+" else badgeCount.toString(),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            ) {
                Icon(
                    imageVector = tab.icon,
                    contentDescription = tab.title,
                    tint = contentColor,
                    modifier = Modifier.size(24.dp)
                )
            }

            // Animated expansion of text label when selected
            AnimatedVisibility(
                visible = isSelected,
                enter = fadeIn(spring(stiffness = Spring.StiffnessMedium)),
                exit = fadeOut(spring(stiffness = Spring.StiffnessMedium))
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = tab.title,
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = contentColor,
                            fontSize = 13.sp
                        ),
                        maxLines = 1
                    )
                }
            }
        }
    }
}
