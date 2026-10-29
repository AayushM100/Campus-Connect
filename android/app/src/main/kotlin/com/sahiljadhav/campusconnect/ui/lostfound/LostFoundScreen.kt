package com.sahiljadhav.campusconnect.ui.lostfound

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Clear
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahiljadhav.campusconnect.data.model.NetworkResult
import com.sahiljadhav.campusconnect.ui.common.EmptyView
import com.sahiljadhav.campusconnect.ui.common.ErrorView
import com.sahiljadhav.campusconnect.ui.common.LoadingView
import com.sahiljadhav.campusconnect.ui.lostfound.components.ItemDetailSheet
import com.sahiljadhav.campusconnect.ui.lostfound.components.LostFoundItemCard
import com.sahiljadhav.campusconnect.ui.lostfound.components.ReportItemDialog
import com.sahiljadhav.campusconnect.ui.theme.AvailableGreen
import com.sahiljadhav.campusconnect.ui.theme.BrandOrange

@Composable
fun LostFoundScreen(
    viewModel: LostFoundViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val filteredItems by viewModel.currentFilteredItems.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    val activeState = if (uiState.activeTab == "lost") uiState.lostItemsState else uiState.foundItemsState

    LaunchedEffect(uiState.reportSuccessMessage) {
        uiState.reportSuccessMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccessMessage()
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Lost vs Found Top Segment Tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(4.dp)
            ) {
                val isLostActive = uiState.activeTab == "lost"
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isLostActive) BrandOrange else Color.Transparent)
                        .clickable { viewModel.selectTab("lost") }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val count = when (val res = uiState.lostItemsState) {
                        is NetworkResult.Success -> " (${res.data.size})"
                        else -> ""
                    }
                    Text(
                        text = "Lost Items$count",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = if (isLostActive) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (!isLostActive) AvailableGreen else Color.Transparent)
                        .clickable { viewModel.selectTab("found") }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val count = when (val res = uiState.foundItemsState) {
                        is NetworkResult.Success -> " (${res.data.size})"
                        else -> ""
                    }
                    Text(
                        text = "Found Items$count",
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Bold,
                            color = if (!isLostActive) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }
            }

            // Search Bar & Report Button
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = uiState.searchQuery,
                    onValueChange = { viewModel.setSearchQuery(it) },
                    placeholder = {
                        Text(
                            text = if (uiState.activeTab == "lost") "Search lost items..." else "Search found items...",
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
                        .weight(1f)
                        .height(52.dp)
                )

                Spacer(modifier = Modifier.width(8.dp))

                // Report Action Button
                Surface(
                    onClick = { viewModel.openReportDialog(uiState.activeTab) },
                    shape = RoundedCornerShape(14.dp),
                    color = if (uiState.activeTab == "lost") BrandOrange else AvailableGreen,
                    modifier = Modifier.height(52.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Add,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Report",
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                    }
                }
            }

            // Category Filter Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                viewModel.categories.forEach { category ->
                    val isSelected = uiState.selectedCategoryFilter == category
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.selectCategoryFilter(category) },
                        label = {
                            Text(
                                text = category,
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                )
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = if (uiState.activeTab == "lost") BrandOrange else AvailableGreen,
                            selectedLabelColor = Color.White,
                            containerColor = MaterialTheme.colorScheme.surface,
                            labelColor = MaterialTheme.colorScheme.onSurfaceVariant
                        ),
                        border = FilterChipDefaults.filterChipBorder(
                            borderColor = if (isSelected) Color.Transparent else MaterialTheme.colorScheme.outlineVariant,
                            selectedBorderColor = Color.Transparent,
                            enabled = true,
                            selected = isSelected
                        ),
                        shape = RoundedCornerShape(10.dp)
                    )
                }
            }

            // Content List / States
            when (val state = activeState) {
                is NetworkResult.Loading -> {
                    LoadingView(message = "Loading ${if (uiState.activeTab == "lost") "lost" else "found"} items...")
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
                            title = if (uiState.activeTab == "lost") "No Lost Items Found" else "No Found Items Listed",
                            subtitle = if (uiState.searchQuery.isNotEmpty())
                                "No items matching \"${uiState.searchQuery}\""
                            else
                                "No items reported in this category yet. Have you lost or found something?",
                            emoji = if (uiState.activeTab == "lost") "🔍" else "🎉",
                            actionButton = {
                                Button(
                                    onClick = { viewModel.openReportDialog(uiState.activeTab) },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (uiState.activeTab == "lost") BrandOrange else AvailableGreen
                                    )
                                ) {
                                    Icon(imageVector = Icons.Rounded.Add, contentDescription = null)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Report an Item")
                                }
                            }
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp),
                            contentPadding = PaddingValues(top = 8.dp, bottom = 80.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(filteredItems, key = { it.serialNumber }) { item ->
                                LostFoundItemCard(
                                    item = item,
                                    onClick = { viewModel.setSelectedItemForDetail(item) }
                                )
                            }
                        }
                    }
                }
            }
        }

        // SnackBar
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 80.dp)
        )
    }

    // Detail Bottom Sheet
    if (uiState.selectedItemForDetail != null) {
        ItemDetailSheet(
            item = uiState.selectedItemForDetail,
            onDismiss = { viewModel.setSelectedItemForDetail(null) }
        )
    }

    // Report Dialog
    if (uiState.isReportDialogOpen) {
        ReportItemDialog(
            initialStatus = uiState.reportDialogInitialStatus,
            onDismiss = { viewModel.closeReportDialog() },
            onSubmit = { itemName, status, location, description, personName, rollNumber, contactNumber, imageFile ->
                viewModel.submitReport(
                    itemName, status, location, description, personName, rollNumber, contactNumber, imageFile
                )
            },
            isSubmitting = uiState.isSubmittingReport,
            errorMessage = uiState.reportErrorMessage
        )
    }
}
