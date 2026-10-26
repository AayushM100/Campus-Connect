package com.sahiljadhav.campusconnect.ui.canteen

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahiljadhav.campusconnect.data.model.NetworkResult
import com.sahiljadhav.campusconnect.ui.canteen.components.FoodDetailSheet
import com.sahiljadhav.campusconnect.ui.canteen.components.FoodItemCard
import com.sahiljadhav.campusconnect.ui.common.EmptyView
import com.sahiljadhav.campusconnect.ui.common.ErrorView
import com.sahiljadhav.campusconnect.ui.common.LoadingView
import com.sahiljadhav.campusconnect.ui.theme.BrandOrange

@Composable
fun CanteenScreen(
    viewModel: CanteenViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val filteredItems by viewModel.filteredMenuItems.collectAsState()
    val tray by viewModel.tray.collectAsState()
    val favouriteIds by viewModel.favouriteItemIds.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Canteen Location Selector Tabs
        CanteenLocationSelector(
            selectedCanteenId = uiState.selectedCanteenId,
            onSelectCanteen = { viewModel.selectCanteen(it) }
        )

        // Search Bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp)
        ) {
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                placeholder = {
                    Text(
                        text = "Search foods, snacks, beverages...",
                        style = MaterialTheme.typography.bodyMedium
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Rounded.Search,
                        contentDescription = "Search",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                trailingIcon = {
                    if (uiState.searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
                            Icon(
                                imageVector = Icons.Rounded.Clear,
                                contentDescription = "Clear",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandOrange,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            )
        }

        // Horizontal Category Filter Chips
        if (uiState.availableCategories.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                uiState.availableCategories.forEach { category ->
                    val isSelected = uiState.selectedCategory == category
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.selectCategory(category) },
                        label = {
                            Text(
                                text = category,
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                )
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = BrandOrange,
                            selectedLabelColor = Color.White,
                            containerColor = MaterialTheme.colorScheme.surface,
                            labelColor = MaterialTheme.colorScheme.onSurfaceVariant
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            borderColor = if (isSelected) BrandOrange else MaterialTheme.colorScheme.outlineVariant,
                            selectedBorderColor = BrandOrange,
                            enabled = true,
                            selected = isSelected
                        ),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            }
        }

        // Content Area (Loading / Error / List / Empty)
        when (val state = uiState.menuState) {
            is NetworkResult.Loading -> {
                LoadingView(message = "Loading verified campus canteen menu...")
            }
            is NetworkResult.Error -> {
                ErrorView(
                    message = state.message,
                    isColdStart = state.isColdStart,
                    onRetry = { viewModel.loadData(forceRefresh = true) }
                )
            }
            is NetworkResult.Success -> {
                if (filteredItems.isEmpty()) {
                    EmptyView(
                        title = "No menu items found",
                        subtitle = if (uiState.searchQuery.isNotEmpty())
                            "No foods matching \"${uiState.searchQuery}\""
                        else
                            "No items in this category currently.",
                        emoji = "🍲"
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        contentPadding = PaddingValues(top = 8.dp, bottom = 80.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        item {
                            Text(
                                text = "Showing ${filteredItems.size} items",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 4.dp, bottom = 4.dp)
                            )
                        }

                        items(filteredItems, key = { it.id }) { item ->
                            val qty = tray.firstOrNull { it.item.id == item.id }?.quantity ?: 0
                            val isFav = favouriteIds.contains(item.id)

                            FoodItemCard(
                                item = item,
                                quantityInTray = qty,
                                isFavourite = isFav,
                                onItemClick = { viewModel.setSelectedItemForDetail(item) },
                                onAddToCart = { viewModel.addToTray(item) },
                                onDecreaseQuantity = { viewModel.decreaseQuantity(item.id) },
                                onToggleFavourite = { viewModel.toggleFavourite(item.id) }
                            )
                        }
                    }
                }
            }
        }
    }

    // Detail Bottom Sheet
    if (uiState.selectedItemForDetail != null) {
        val selectedItem = uiState.selectedItemForDetail
        val qty = selectedItem?.let { item ->
            tray.firstOrNull { it.item.id == item.id }?.quantity
        } ?: 0
        val isFav = selectedItem?.let { favouriteIds.contains(it.id) } ?: false

        FoodDetailSheet(
            item = selectedItem,
            currentQuantityInTray = qty,
            isFavourite = isFav,
            onDismiss = { viewModel.setSelectedItemForDetail(null) },
            onAddToCart = { quantity ->
                selectedItem?.let { item ->
                    // Set quantity
                    viewModel.addToTray(item)
                }
            },
            onToggleFavourite = {
                selectedItem?.let { viewModel.toggleFavourite(it.id) }
            }
        )
    }
}

@Composable
private fun CanteenLocationSelector(
    selectedCanteenId: String,
    onSelectCanteen: (String) -> Unit
) {
    val locations = listOf(
        Triple("all", "All Outlets", "🍴"),
        Triple("cafeteria", "Cafeteria", "🍛"),
        Triple("timeless", "Timeless", "🍔"),
        Triple("nescafe", "Nescafe", "☕")
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        locations.forEach { (id, title, emoji) ->
            val isSelected = selectedCanteenId == id
            Surface(
                onClick = { onSelectCanteen(id) },
                shape = RoundedCornerShape(12.dp),
                color = if (isSelected) BrandOrange else MaterialTheme.colorScheme.surface,
                shadowElevation = if (isSelected) 3.dp else 1.dp
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)
                ) {
                    Text(text = emoji, fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = title,
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                        )
                    )
                }
            }
        }
    }
}
