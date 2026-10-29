package com.sahiljadhav.campusconnect.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sahiljadhav.campusconnect.data.model.Canteen
import com.sahiljadhav.campusconnect.data.model.LostFoundItem
import com.sahiljadhav.campusconnect.data.model.MenuItem
import com.sahiljadhav.campusconnect.data.model.NetworkResult
import com.sahiljadhav.campusconnect.data.repository.CanteenRepository
import com.sahiljadhav.campusconnect.data.repository.LostFoundRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeUiState(
    val canteens: List<Canteen> = emptyList(),
    val campusPicks: List<MenuItem> = emptyList(),
    val recentLostItems: List<LostFoundItem> = emptyList(),
    val recentFoundItems: List<LostFoundItem> = emptyList(),
    val isLoading: Boolean = true,
    val errorMessage: String? = null
)

class HomeViewModel(
    private val canteenRepository: CanteenRepository = CanteenRepository(),
    private val lostFoundRepository: LostFoundRepository = LostFoundRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadDashboardData()
    }

    fun loadDashboardData(forceRefresh: Boolean = false) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null)

            // 1. Canteens
            val canteensRes = canteenRepository.getCanteens()
            val canteens = when (canteensRes) {
                is NetworkResult.Success -> canteensRes.data
                else -> canteenRepository.defaultCanteens
            }

            // 2. Campus Picks
            val picksRes = canteenRepository.getCampusPicks()
            val picks = when (picksRes) {
                is NetworkResult.Success -> picksRes.data
                else -> emptyList()
            }

            // 3. Recent Lost & Found Items
            val lostRes = lostFoundRepository.getLostItems(forceRefresh)
            val foundRes = lostFoundRepository.getFoundItems(forceRefresh)

            val recentLost = when (lostRes) {
                is NetworkResult.Success -> lostRes.data.take(4)
                else -> emptyList()
            }

            val recentFound = when (foundRes) {
                is NetworkResult.Success -> foundRes.data.take(4)
                else -> emptyList()
            }

            _uiState.value = HomeUiState(
                canteens = canteens,
                campusPicks = picks,
                recentLostItems = recentLost,
                recentFoundItems = recentFound,
                isLoading = false,
                errorMessage = null
            )
        }
    }
}
