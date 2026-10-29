package com.sahiljadhav.campusconnect.ui.canteen.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.ShoppingBag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahiljadhav.campusconnect.data.model.TrayItem
import com.sahiljadhav.campusconnect.ui.common.CampusImage
import com.sahiljadhav.campusconnect.ui.common.EmptyView
import com.sahiljadhav.campusconnect.ui.components.CampusGlassButton
import com.sahiljadhav.campusconnect.ui.components.GlassButtonVariant
import com.sahiljadhav.campusconnect.ui.theme.AvailableGreen
import com.sahiljadhav.campusconnect.ui.theme.BrandOrange

@Composable
fun TrayContent(
    trayItems: List<TrayItem>,
    onIncreaseQuantity: (Long) -> Unit,
    onDecreaseQuantity: (Long) -> Unit,
    onRemoveItem: (Long) -> Unit,
    onClearTray: () -> Unit,
    onBrowseMenu: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showCheckoutDialog by remember { mutableStateOf(false) }
    var orderSuccessDialog by remember { mutableStateOf(false) }

    val subtotal = trayItems.sumOf { it.totalCost }
    val subtotalFormatted = if (subtotal % 1.0 == 0.0) "₹${subtotal.toInt()}" else "₹${String.format("%.2f", subtotal)}"

    if (trayItems.isEmpty()) {
        EmptyView(
            title = "Your Tray is Empty",
            subtitle = "Explore the delicious canteen menu and add your favorite dishes to your tray.",
            emoji = "🍽️",
            modifier = modifier,
            actionButton = {
                Button(
                    onClick = onBrowseMenu,
                    colors = ButtonDefaults.buttonColors(containerColor = BrandOrange),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(imageVector = Icons.Rounded.ShoppingBag, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Browse Canteen Menu")
                }
            }
        )
        return
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        // Tray Header & Clear action
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Campus Bites Tray",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${trayItems.sumOf { it.quantity }} items selected",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            TextButton(onClick = onClearTray) {
                Icon(
                    imageVector = Icons.Rounded.DeleteOutline,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "Clear Tray",
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.labelMedium
                )
            }
        }

        // List of items in tray
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(trayItems, key = { it.item.id }) { trayItem ->
                Card(
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CampusImage(
                            imageUrl = trayItem.item.imageUrl,
                            fallbackEmoji = trayItem.item.categoryIcon,
                            contentDescription = trayItem.item.itemName,
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(10.dp))
                        )

                        Spacer(modifier = Modifier.width(12.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = trayItem.item.itemName,
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "${trayItem.item.priceFormatted} each • ${trayItem.item.canteen.replaceFirstChar { it.uppercase() }}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = trayItem.totalCostFormatted,
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = BrandOrange
                                )
                            )
                        }

                        // Stepper controls
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .padding(2.dp)
                        ) {
                            Surface(
                                onClick = { onDecreaseQuantity(trayItem.item.id) },
                                shape = CircleShape,
                                color = MaterialTheme.colorScheme.surface,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Remove,
                                    contentDescription = "Decrease",
                                    tint = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(4.dp)
                                )
                            }

                            Text(
                                text = trayItem.quantity.toString(),
                                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold),
                                modifier = Modifier.padding(horizontal = 8.dp)
                            )

                            Surface(
                                onClick = { onIncreaseQuantity(trayItem.item.id) },
                                shape = CircleShape,
                                color = BrandOrange,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Add,
                                    contentDescription = "Increase",
                                    tint = Color.White,
                                    modifier = Modifier.padding(4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Price Breakdown Card
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Items Total", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(subtotalFormatted, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold))
                }
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Campus Service Fee", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("FREE", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = AvailableGreen))
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Total Amount", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                    Text(
                        subtotalFormatted,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = BrandOrange)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Checkout Button (Liquid Glass Button)
        CampusGlassButton(
            onClick = { showCheckoutDialog = true },
            variant = GlassButtonVariant.BRAND_ORANGE,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "Proceed with Order ($subtotalFormatted)",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Color.White)
            )
        }

        Spacer(modifier = Modifier.height(16.dp))
    }

    // Checkout Details Dialog
    if (showCheckoutDialog) {
        var customerName by remember { mutableStateOf("") }
        var department by remember { mutableStateOf("") }
        var phone by remember { mutableStateOf("") }
        var rollNumber by remember { mutableStateOf("") }
        var errorMessage by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showCheckoutDialog = false },
            title = {
                Text("Order Details", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Please enter your student details to place your verified canteen tray summary.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    OutlinedTextField(
                        value = customerName,
                        onValueChange = { customerName = it },
                        label = { Text("Student Name *") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = BrandOrange)
                    )

                    OutlinedTextField(
                        value = department,
                        onValueChange = { department = it },
                        label = { Text("Department * (e.g. Computer Science)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = BrandOrange)
                    )

                    OutlinedTextField(
                        value = phone,
                        onValueChange = { if (it.length <= 10) phone = it },
                        label = { Text("Phone Number (10 digits) *") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = BrandOrange)
                    )

                    OutlinedTextField(
                        value = rollNumber,
                        onValueChange = { rollNumber = it },
                        label = { Text("Roll Number (Optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = BrandOrange)
                    )

                    if (errorMessage != null) {
                        Text(
                            text = errorMessage ?: "",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (customerName.isBlank() || department.isBlank() || phone.length < 10) {
                            errorMessage = "Please fill in student name, department and valid 10-digit phone number."
                        } else {
                            showCheckoutDialog = false
                            orderSuccessDialog = true
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandOrange)
                ) {
                    Text("Confirm Order")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCheckoutDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Order Success Dialog
    if (orderSuccessDialog) {
        AlertDialog(
            onDismissRequest = {
                orderSuccessDialog = false
                onClearTray()
            },
            icon = {
                Icon(
                    imageVector = Icons.Rounded.CheckCircle,
                    contentDescription = null,
                    tint = AvailableGreen,
                    modifier = Modifier.size(48.dp)
                )
            },
            title = {
                Text("Order Saved Successfully!", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
            },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "Your canteen order token has been prepared. Please collect your order from the respective canteen counter.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "Total Amount: $subtotalFormatted",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold, color = BrandOrange)
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        orderSuccessDialog = false
                        onClearTray()
                        onBrowseMenu()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = BrandOrange)
                ) {
                    Text("Done")
                }
            }
        )
    }
}
