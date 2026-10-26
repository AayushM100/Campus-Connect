package com.sahiljadhav.campusconnect.ui.common

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.ShoppingBag
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahiljadhav.campusconnect.R
import com.sahiljadhav.campusconnect.ui.theme.BrandOrange

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CampusTopBar(
    title: String = "CampusConnect",
    subtitle: String? = null,
    trayItemCount: Int = 0,
    onTrayClick: (() -> Unit)? = null,
    onRefreshClick: (() -> Unit)? = null
) {
    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(BrandOrange.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.app_logo),
                        contentDescription = "CampusConnect Logo",
                        modifier = Modifier.size(28.dp)
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        ),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (!subtitle.isNullOrBlank()) {
                        Text(
                            text = subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = BrandOrange
                        )
                    }
                }
            }
        },
        actions = {
            if (onRefreshClick != null) {
                IconButton(onClick = onRefreshClick) {
                    Icon(
                        imageVector = Icons.Rounded.Refresh,
                        contentDescription = "Refresh",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (onTrayClick != null) {
                IconButton(onClick = onTrayClick) {
                    BadgedBox(
                        badge = {
                            if (trayItemCount > 0) {
                                Badge(
                                    containerColor = BrandOrange,
                                    contentColor = MaterialTheme.colorScheme.surface
                                ) {
                                    Text(text = trayItemCount.toString())
                                }
                            }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.ShoppingBag,
                            contentDescription = "Canteen Tray",
                            tint = if (trayItemCount > 0) BrandOrange else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}
