package com.sahiljadhav.campusconnect.ui.canteen.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahiljadhav.campusconnect.data.model.MenuItem
import com.sahiljadhav.campusconnect.ui.common.CampusImage
import com.sahiljadhav.campusconnect.ui.theme.AvailableGreen
import com.sahiljadhav.campusconnect.ui.theme.BrandOrange
import com.sahiljadhav.campusconnect.ui.theme.UnavailableRed

@Composable
fun FoodItemCard(
    item: MenuItem,
    quantityInTray: Int,
    isFavourite: Boolean,
    onItemClick: () -> Unit,
    onAddToCart: () -> Unit,
    onDecreaseQuantity: () -> Unit,
    onToggleFavourite: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onItemClick() },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Food Image with Availability indicator
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(RoundedCornerShape(12.dp))
            ) {
                CampusImage(
                    imageUrl = item.imageUrl,
                    fallbackEmoji = item.categoryIcon,
                    contentDescription = item.itemName,
                    modifier = Modifier.fillMaxWidth().height(96.dp)
                )

                // Availability badge
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(4.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(
                            if (item.isItemAvailable) AvailableGreen.copy(alpha = 0.9f)
                            else UnavailableRed.copy(alpha = 0.9f)
                        )
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = if (item.isItemAvailable) "Available" else "Out of Stock",
                        color = Color.White,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.width(14.dp))

            // Food Info & Actions
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = item.itemName,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "${item.category} • ${item.canteen.replaceFirstChar { it.uppercase() }}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Favourite heart button
                    IconButton(
                        onClick = onToggleFavourite,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = if (isFavourite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                            contentDescription = "Toggle Favourite",
                            tint = if (isFavourite) BrandOrange else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                if (!item.description.isNullOrBlank() && item.description != item.itemName) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Price and Add/Quantity controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = item.priceFormatted,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = BrandOrange
                        )
                    )

                    if (item.isItemAvailable) {
                        if (quantityInTray > 0) {
                            // Stepper (- Qty +)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(BrandOrange.copy(alpha = 0.12f))
                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                            ) {
                                Surface(
                                    onClick = onDecreaseQuantity,
                                    shape = CircleShape,
                                    color = Color.Transparent,
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Remove,
                                        contentDescription = "Decrease",
                                        tint = BrandOrange,
                                        modifier = Modifier.padding(4.dp)
                                    )
                                }

                                Text(
                                    text = quantityInTray.toString(),
                                    style = MaterialTheme.typography.labelLarge.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = BrandOrange
                                    ),
                                    modifier = Modifier.padding(horizontal = 8.dp)
                                )

                                Surface(
                                    onClick = onAddToCart,
                                    shape = CircleShape,
                                    color = BrandOrange,
                                    modifier = Modifier.size(26.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Add,
                                        contentDescription = "Increase",
                                        tint = Color.White,
                                        modifier = Modifier.padding(4.dp)
                                    )
                                }
                            }
                        } else {
                            // Single Add to Tray button
                            Surface(
                                onClick = onAddToCart,
                                shape = RoundedCornerShape(8.dp),
                                color = BrandOrange.copy(alpha = 0.12f),
                                modifier = Modifier.height(32.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(horizontal = 10.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.Add,
                                        contentDescription = null,
                                        tint = BrandOrange,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Add",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = BrandOrange
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
