package com.sahiljadhav.campusconnect.ui.auth

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sahiljadhav.campusconnect.data.model.UpdateProfileRequest
import com.sahiljadhav.campusconnect.ui.components.CampusGlassButton

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    viewModel: AuthViewModel,
    onBack: () -> Unit,
    onNavigateToMyReports: () -> Unit,
    onNavigateToMyOrders: () -> Unit,
    onSignOutComplete: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val isOperationLoading by viewModel.isOperationLoading.collectAsState()

    var editSheetOpen by remember { mutableStateOf(false) }
    var deleteAccountDialogVisible by remember { mutableStateOf(false) }

    val user = (uiState as? AuthUiState.Authenticated)?.user
    val profile = (uiState as? AuthUiState.Authenticated)?.profile
    val completionPercentage = (uiState as? AuthUiState.Authenticated)?.completionPercentage ?: 0

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Student Profile", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Rounded.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // User Header Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    val displayName = profile?.fullName ?: user?.displayName ?: "Student"
                    val initials = if (displayName.length >= 2) {
                        displayName.split(" ").filter { it.isNotBlank() }.take(2)
                            .map { it.first().uppercase() }.joinToString("")
                    } else "CC"

                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initials,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp
                        )
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = displayName,
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = user?.email ?: "student@dypcoe.edu.in",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    IconButton(
                        onClick = { editSheetOpen = true }
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.Edit,
                            contentDescription = "Edit Profile",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // Profile Completion Meter
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Profile Completion",
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "$completionPercentage% Complete",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 14.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    val animatedProgress by animateFloatAsState(
                        targetValue = completionPercentage / 100f,
                        label = "progress"
                    )

                    LinearProgressIndicator(
                        progress = { animatedProgress },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(99.dp)),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = if (completionPercentage == 100)
                            "✨ Complete! Your details are pre-filled during canteen checkout."
                        else
                            "Fill in your department, roll number, and phone for 1-tap checkout.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Academic & Contact Info Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "Academic Details",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    ProfileItemRow(
                        icon = Icons.Rounded.School,
                        label = "Department",
                        value = profile?.department ?: "Not set"
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                    ProfileItemRow(
                        icon = Icons.Rounded.Badge,
                        label = "Roll Number",
                        value = profile?.rollNumber ?: "Not set"
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                    ProfileItemRow(
                        icon = Icons.Rounded.CalendarToday,
                        label = "Year & Division",
                        value = "${profile?.year ?: "Not set"} ${if (!profile?.division.isNullOrBlank()) "• Div " + profile.division else ""}"
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                    ProfileItemRow(
                        icon = Icons.Rounded.Phone,
                        label = "Phone Number",
                        value = profile?.phone ?: "Not set"
                    )
                }
            }

            // My Activity Navigation Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp)
                ) {
                    NavigationItemRow(
                        icon = Icons.Rounded.Search,
                        title = "My Lost & Found Reports",
                        subtitle = "Manage items you reported on campus",
                        onClick = onNavigateToMyReports
                    )

                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                    NavigationItemRow(
                        icon = Icons.Rounded.ShoppingBag,
                        title = "My Canteen Orders",
                        subtitle = "View order receipts and pickup statuses",
                        onClick = onNavigateToMyOrders
                    )
                }
            }

            // Sign Out Button
            CampusGlassButton(
                text = "Sign Out",
                onClick = {
                    viewModel.signOut()
                    onSignOutComplete()
                },
                modifier = Modifier.fillMaxWidth()
            )

            // Delete Account Danger Zone
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                TextButton(
                    onClick = { deleteAccountDialogVisible = true }
                ) {
                    Text(
                        text = "Delete Account Data",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold)
                    )
                }
            }
        }
    }

    // Edit Profile Bottom Sheet
    if (editSheetOpen) {
        EditProfileBottomSheet(
            currentProfile = profile,
            currentUser = user,
            isLoading = isOperationLoading,
            onDismiss = { editSheetOpen = false },
            onSave = { updatedRequest ->
                viewModel.updateProfile(
                    request = updatedRequest,
                    onSuccess = { editSheetOpen = false },
                    onError = {}
                )
            }
        )
    }

    // Delete Account Confirmation Dialog
    if (deleteAccountDialogVisible) {
        AlertDialog(
            onDismissRequest = { deleteAccountDialogVisible = false },
            icon = { Icon(Icons.Rounded.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text("Delete Account?") },
            text = {
                Text("This will permanently delete your profile, favourites, and reports from the database. This action cannot be undone.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        deleteAccountDialogVisible = false
                        viewModel.deleteAccount(
                            onSuccess = onSignOutComplete,
                            onError = {}
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete Permanently")
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteAccountDialogVisible = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun ProfileItemRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

@Composable
private fun NavigationItemRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold),
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Rounded.KeyboardArrowRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditProfileBottomSheet(
    currentProfile: com.sahiljadhav.campusconnect.data.model.UserProfile?,
    currentUser: com.sahiljadhav.campusconnect.data.repository.AuthUser?,
    isLoading: Boolean,
    onDismiss: () -> Unit,
    onSave: (UpdateProfileRequest) -> Unit
) {
    var fullName by remember { mutableStateOf(currentProfile?.fullName ?: currentUser?.displayName ?: "") }
    var phone by remember { mutableStateOf(currentProfile?.phone ?: "") }
    var department by remember { mutableStateOf(currentProfile?.department ?: "") }
    var rollNumber by remember { mutableStateOf(currentProfile?.rollNumber ?: "") }
    var year by remember { mutableStateOf(currentProfile?.year ?: "") }
    var division by remember { mutableStateOf(currentProfile?.division ?: "") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Text(
                text = "Edit Student Profile",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
            )

            OutlinedTextField(
                value = fullName,
                onValueChange = { fullName = it },
                label = { Text("Full Name") },
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Phone Number (10 digits)") },
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = department,
                onValueChange = { department = it },
                label = { Text("Department (e.g. Computer Engineering)") },
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedTextField(
                    value = rollNumber,
                    onValueChange = { rollNumber = it },
                    label = { Text("Roll Number") },
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )

                OutlinedTextField(
                    value = year,
                    onValueChange = { year = it },
                    label = { Text("Year (e.g. TE)") },
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
            }

            OutlinedTextField(
                value = division,
                onValueChange = { division = it },
                label = { Text("Division (e.g. A)") },
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            CampusGlassButton(
                text = if (isLoading) "Saving..." else "Save Changes",
                onClick = {
                    onSave(
                        UpdateProfileRequest(
                            fullName = fullName.trim().ifBlank { null },
                            phone = phone.trim().ifBlank { null },
                            department = department.trim().ifBlank { null },
                            rollNumber = rollNumber.trim().ifBlank { null },
                            year = year.trim().ifBlank { null },
                            division = division.trim().ifBlank { null }
                        )
                    )
                },
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
