package com.sahiljadhav.campusconnect.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sahiljadhav.campusconnect.data.model.*
import com.sahiljadhav.campusconnect.data.repository.AuthRepository
import com.sahiljadhav.campusconnect.data.repository.AuthUser
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

sealed class AuthUiState {
    object Unauthenticated : AuthUiState()
    object Loading : AuthUiState()
    data class Authenticated(
        val user: AuthUser,
        val profile: UserProfile? = null,
        val completionPercentage: Int = 0
    ) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}

class AuthViewModel(
    private val repository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Loading)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private val _myReports = MutableStateFlow<List<LostFoundItem>>(emptyList())
    val myReports: StateFlow<List<LostFoundItem>> = _myReports.asStateFlow()

    private val _myOrders = MutableStateFlow<List<UserOrder>>(emptyList())
    val myOrders: StateFlow<List<UserOrder>> = _myOrders.asStateFlow()

    private val _isOperationLoading = MutableStateFlow(false)
    val isOperationLoading: StateFlow<Boolean> = _isOperationLoading.asStateFlow()

    private val _authGateVisible = MutableStateFlow(false)
    val authGateVisible: StateFlow<Boolean> = _authGateVisible.asStateFlow()

    private val _authGateReason = MutableStateFlow("Sign in to your college account to continue.")
    val authGateReason: StateFlow<String> = _authGateReason.asStateFlow()

    init {
        viewModelScope.launch {
            repository.currentUser.collect { user ->
                if (user != null) {
                    refreshProfile(user)
                    loadMyReports()
                    loadMyOrders()
                } else {
                    _uiState.value = AuthUiState.Unauthenticated
                    _myReports.value = emptyList()
                    _myOrders.value = emptyList()
                }
            }
        }
    }

    fun showAuthGate(reason: String = "Sign in to your college account to continue.") {
        _authGateReason.value = reason
        _authGateVisible.value = true
    }

    fun hideAuthGate() {
        _authGateVisible.value = false
    }

    fun signIn(
        email: String,
        pass: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isOperationLoading.value = true
            when (val res = repository.signIn(email, pass)) {
                is NetworkResult.Success -> {
                    _isOperationLoading.value = false
                    hideAuthGate()
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _isOperationLoading.value = false
                    onError(res.message)
                }
                else -> {
                    _isOperationLoading.value = false
                }
            }
        }
    }

    fun signUp(
        email: String,
        pass: String,
        fullName: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isOperationLoading.value = true
            when (val res = repository.signUp(email, pass, fullName)) {
                is NetworkResult.Success -> {
                    _isOperationLoading.value = false
                    hideAuthGate()
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _isOperationLoading.value = false
                    onError(res.message)
                }
                else -> {
                    _isOperationLoading.value = false
                }
            }
        }
    }

    fun sendPasswordReset(
        email: String,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isOperationLoading.value = true
            when (val res = repository.sendPasswordReset(email)) {
                is NetworkResult.Success -> {
                    _isOperationLoading.value = false
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _isOperationLoading.value = false
                    onError(res.message)
                }
                else -> {
                    _isOperationLoading.value = false
                }
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            repository.signOut()
        }
    }

    fun refreshProfile(user: AuthUser? = repository.currentUser.value) {
        if (user == null) {
            _uiState.value = AuthUiState.Unauthenticated
            return
        }
        viewModelScope.launch {
            when (val res = repository.fetchProfile()) {
                is NetworkResult.Success -> {
                    _uiState.value = AuthUiState.Authenticated(
                        user = user,
                        profile = res.data.user,
                        completionPercentage = res.data.completionPercentage
                    )
                }
                is NetworkResult.Error -> {
                    _uiState.value = AuthUiState.Authenticated(
                        user = user,
                        profile = null,
                        completionPercentage = 0
                    )
                }
                else -> {}
            }
        }
    }

    fun updateProfile(
        request: UpdateProfileRequest,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isOperationLoading.value = true
            when (val res = repository.updateProfile(request)) {
                is NetworkResult.Success -> {
                    _isOperationLoading.value = false
                    val user = repository.currentUser.value
                    if (user != null) {
                        _uiState.value = AuthUiState.Authenticated(
                            user = user,
                            profile = res.data.user,
                            completionPercentage = res.data.completionPercentage
                        )
                    }
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _isOperationLoading.value = false
                    onError(res.message)
                }
                else -> {
                    _isOperationLoading.value = false
                }
            }
        }
    }

    fun deleteAccount(
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isOperationLoading.value = true
            when (val res = repository.deleteAccount()) {
                is NetworkResult.Success -> {
                    _isOperationLoading.value = false
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _isOperationLoading.value = false
                    onError(res.message)
                }
                else -> {
                    _isOperationLoading.value = false
                }
            }
        }
    }

    fun loadMyReports() {
        viewModelScope.launch {
            when (val res = repository.fetchMyReports()) {
                is NetworkResult.Success -> {
                    val all = res.data.lost + res.data.found
                    _myReports.value = all
                }
                else -> {}
            }
        }
    }

    fun loadMyOrders() {
        viewModelScope.launch {
            when (val res = repository.fetchMyOrders()) {
                is NetworkResult.Success -> {
                    _myOrders.value = res.data
                }
                else -> {}
            }
        }
    }

    fun deleteReport(
        id: Long,
        type: String?,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isOperationLoading.value = true
            when (val res = repository.deleteReport(id, type)) {
                is NetworkResult.Success -> {
                    _isOperationLoading.value = false
                    _myReports.value = _myReports.value.filter { it.id != id }
                    onSuccess()
                }
                is NetworkResult.Error -> {
                    _isOperationLoading.value = false
                    onError(res.message)
                }
                else -> {
                    _isOperationLoading.value = false
                }
            }
        }
    }
}
