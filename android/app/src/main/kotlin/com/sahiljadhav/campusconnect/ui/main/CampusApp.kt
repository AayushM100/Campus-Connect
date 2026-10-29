package com.sahiljadhav.campusconnect.ui.main

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sahiljadhav.campusconnect.ui.canteen.CanteenScreen
import com.sahiljadhav.campusconnect.ui.canteen.CanteenViewModel
import com.sahiljadhav.campusconnect.ui.canteen.components.TrayContent
import com.sahiljadhav.campusconnect.ui.components.CampusDock
import com.sahiljadhav.campusconnect.ui.common.CampusTab
import com.sahiljadhav.campusconnect.ui.common.CampusTopBar
import com.sahiljadhav.campusconnect.ui.home.HomeScreen
import com.sahiljadhav.campusconnect.ui.home.HomeViewModel
import com.sahiljadhav.campusconnect.ui.lostfound.LostFoundScreen
import com.sahiljadhav.campusconnect.ui.lostfound.LostFoundViewModel

@Composable
fun CampusApp(
    modifier: Modifier = Modifier
) {
    var activeTab by rememberSaveable { mutableStateOf(CampusTab.HOME) }

    val canteenViewModel: CanteenViewModel = viewModel()
    val lostFoundViewModel: LostFoundViewModel = viewModel()
    val homeViewModel: HomeViewModel = viewModel()

    val tray by canteenViewModel.tray.collectAsState()
    val trayItemCount = tray.sumOf { it.quantity }

    // Intercept back gesture if on another tab and return to Home
    BackHandler(enabled = activeTab != CampusTab.HOME) {
        activeTab = CampusTab.HOME
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            CampusTopBar(
                title = when (activeTab) {
                    CampusTab.HOME -> "CampusConnect"
                    CampusTab.CANTEEN -> "Campus Bites"
                    CampusTab.LOST_FOUND -> "Lost & Found"
                    CampusTab.TRAY -> "Canteen Tray"
                },
                subtitle = when (activeTab) {
                    CampusTab.HOME -> "Student Services Hub"
                    CampusTab.CANTEEN -> "Digital Canteen Menu"
                    CampusTab.LOST_FOUND -> "Browse & Report Items"
                    CampusTab.TRAY -> "Order Summary & Review"
                },
                trayItemCount = trayItemCount,
                onTrayClick = { activeTab = CampusTab.TRAY },
                onRefreshClick = {
                    when (activeTab) {
                        CampusTab.HOME -> homeViewModel.loadDashboardData(forceRefresh = true)
                        CampusTab.CANTEEN -> canteenViewModel.loadData(forceRefresh = true)
                        CampusTab.LOST_FOUND -> lostFoundViewModel.loadData(forceRefresh = true)
                        CampusTab.TRAY -> Unit
                    }
                }
            )
        },
        bottomBar = {
            CampusDock(
                selectedTab = activeTab,
                onTabSelected = { activeTab = it },
                trayCount = trayItemCount
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (activeTab) {
                CampusTab.HOME -> HomeScreen(
                    viewModel = homeViewModel,
                    onNavigateTab = { tab -> activeTab = tab },
                    onAddToCart = { item -> canteenViewModel.addToTray(item) },
                    onReportClick = { status ->
                        activeTab = CampusTab.LOST_FOUND
                        lostFoundViewModel.openReportDialog(status)
                    }
                )
                CampusTab.CANTEEN -> CanteenScreen(
                    viewModel = canteenViewModel
                )
                CampusTab.LOST_FOUND -> LostFoundScreen(
                    viewModel = lostFoundViewModel
                )
                CampusTab.TRAY -> TrayContent(
                    trayItems = tray,
                    onIncreaseQuantity = { id ->
                        val item = tray.firstOrNull { it.item.id == id }?.item
                        if (item != null) canteenViewModel.addToTray(item)
                    },
                    onDecreaseQuantity = { id -> canteenViewModel.decreaseQuantity(id) },
                    onRemoveItem = { id -> canteenViewModel.removeFromTray(id) },
                    onClearTray = { canteenViewModel.clearTray() },
                    onBrowseMenu = { activeTab = CampusTab.CANTEEN }
                )
            }
        }
    }
}
