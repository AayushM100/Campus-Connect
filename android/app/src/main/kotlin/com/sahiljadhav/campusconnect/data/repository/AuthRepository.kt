package com.sahiljadhav.campusconnect.data.repository

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserProfileChangeRequest
import com.sahiljadhav.campusconnect.data.api.ApiClient
import com.sahiljadhav.campusconnect.data.api.AuthApiService
import com.sahiljadhav.campusconnect.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

data class AuthUser(
    val uid: String,
    val email: String,
    val displayName: String? = null
)

class AuthRepository(
    private val context: Context,
    private val authApi: AuthApiService = ApiClient.authApi
) {
    private val tag = "AuthRepository"
    private val prefs: SharedPreferences =
        context.getSharedPreferences("campusconnect_auth_prefs", Context.MODE_PRIVATE)

    private val _currentUser = MutableStateFlow<AuthUser?>(null)
    val currentUser: StateFlow<AuthUser?> = _currentUser.asStateFlow()

    private var firebaseAuth: FirebaseAuth? = null
    private var isDevMockMode = false

    init {
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context)
            }
            firebaseAuth = FirebaseAuth.getInstance()
            firebaseAuth?.addAuthStateListener { auth ->
                val fbUser = auth.currentUser
                if (fbUser != null) {
                    val user = AuthUser(
                        uid = fbUser.uid,
                        email = fbUser.email.orEmpty(),
                        displayName = fbUser.displayName
                    )
                    _currentUser.value = user
                    // Refresh token asynchronously
                    fbUser.getIdToken(false).addOnSuccessListener { tokenResult ->
                        ApiClient.currentAuthToken = tokenResult.token
                    }
                } else if (!isDevMockMode) {
                    _currentUser.value = null
                    ApiClient.currentAuthToken = null
                }
            }
        } catch (e: Exception) {
            Log.w(tag, "Firebase Auth not available; activating dev fallback: ${e.message}")
            isDevMockMode = true
            loadDevMockUser()
        }
    }

    private fun loadDevMockUser() {
        val uid = prefs.getString("mock_uid", null)
        val email = prefs.getString("mock_email", null)
        val name = prefs.getString("mock_name", null)
        if (!uid.isNullOrBlank() && !email.isNullOrBlank()) {
            val user = AuthUser(uid = uid, email = email, displayName = name)
            _currentUser.value = user
            ApiClient.currentAuthToken = "test_${uid}_${email}"
        }
    }

    suspend fun signIn(email: String, pass: String): NetworkResult<AuthUser> = withContext(Dispatchers.IO) {
        val auth = firebaseAuth
        if (auth != null && !isDevMockMode) {
            try {
                val result = auth.signInWithEmailAndPassword(email.trim(), pass).await()
                val fbUser = result.user ?: throw Exception("Failed to retrieve user after sign in")
                val token = fbUser.getIdToken(false).await().token
                ApiClient.currentAuthToken = token
                val user = AuthUser(
                    uid = fbUser.uid,
                    email = fbUser.email.orEmpty(),
                    displayName = fbUser.displayName
                )
                _currentUser.value = user
                return@withContext NetworkResult.Success(user)
            } catch (e: Exception) {
                Log.w(tag, "Firebase sign in failed (${e.message}), trying mock fallback if network issue")
                if (e.message?.contains("network", ignoreCase = true) == true ||
                    e.message?.contains("api key", ignoreCase = true) == true
                ) {
                    isDevMockMode = true
                } else {
                    return@withContext NetworkResult.Error("Sign in failed: ${e.localizedMessage}")
                }
            }
        }

        // Mock sign in fallback
        val cleanUid = email.replace(Regex("[^a-zA-Z0-9]"), "_").lowercase()
        val displayName = email.substringBefore("@").replaceFirstChar { it.uppercase() }
        val user = AuthUser(uid = cleanUid, email = email, displayName = displayName)
        prefs.edit()
            .putString("mock_uid", cleanUid)
            .putString("mock_email", email)
            .putString("mock_name", displayName)
            .apply()
        _currentUser.value = user
        ApiClient.currentAuthToken = "test_${cleanUid}_${email}"
        NetworkResult.Success(user)
    }

    suspend fun signUp(email: String, pass: String, name: String): NetworkResult<AuthUser> = withContext(Dispatchers.IO) {
        val auth = firebaseAuth
        if (auth != null && !isDevMockMode) {
            try {
                val result = auth.createUserWithEmailAndPassword(email.trim(), pass).await()
                val fbUser = result.user ?: throw Exception("Failed to retrieve user after registration")
                if (name.isNotBlank()) {
                    val update = UserProfileChangeRequest.Builder()
                        .setDisplayName(name.trim())
                        .build()
                    fbUser.updateProfile(update).await()
                }
                fbUser.sendEmailVerification()
                val token = fbUser.getIdToken(false).await().token
                ApiClient.currentAuthToken = token
                val user = AuthUser(
                    uid = fbUser.uid,
                    email = fbUser.email.orEmpty(),
                    displayName = name
                )
                _currentUser.value = user

                // Initialize profile in backend
                try {
                    authApi.updateProfile(UpdateProfileRequest(
                        fullName = name,
                        phone = null,
                        department = null,
                        rollNumber = null,
                        year = null,
                        division = null
                    ))
                } catch (pe: Exception) {
                    Log.w(tag, "Backend profile init notice: ${pe.message}")
                }

                return@withContext NetworkResult.Success(user)
            } catch (e: Exception) {
                Log.w(tag, "Firebase sign up failed: ${e.message}")
                if (e.message?.contains("network", ignoreCase = true) == true ||
                    e.message?.contains("api key", ignoreCase = true) == true
                ) {
                    isDevMockMode = true
                } else {
                    return@withContext NetworkResult.Error("Registration failed: ${e.localizedMessage}")
                }
            }
        }

        // Mock sign up fallback
        val cleanUid = email.replace(Regex("[^a-zA-Z0-9]"), "_").lowercase()
        val user = AuthUser(uid = cleanUid, email = email, displayName = name)
        prefs.edit()
            .putString("mock_uid", cleanUid)
            .putString("mock_email", email)
            .putString("mock_name", name)
            .apply()
        _currentUser.value = user
        ApiClient.currentAuthToken = "test_${cleanUid}_${email}"
        NetworkResult.Success(user)
    }

    suspend fun sendPasswordReset(email: String): NetworkResult<Unit> = withContext(Dispatchers.IO) {
        val auth = firebaseAuth
        if (auth != null && !isDevMockMode) {
            try {
                auth.sendPasswordResetEmail(email.trim()).await()
                return@withContext NetworkResult.Success(Unit)
            } catch (e: Exception) {
                return@withContext NetworkResult.Error("Could not send reset email: ${e.localizedMessage}")
            }
        }
        NetworkResult.Success(Unit)
    }

    suspend fun signOut(): Unit = withContext(Dispatchers.IO) {
        firebaseAuth?.signOut()
        prefs.edit().clear().apply()
        _currentUser.value = null
        ApiClient.currentAuthToken = null
    }

    suspend fun fetchProfile(): NetworkResult<ProfileResponse> = withContext(Dispatchers.IO) {
        try {
            val response = authApi.getProfile()
            NetworkResult.Success(response)
        } catch (e: Exception) {
            NetworkResult.Error("Could not load profile: ${e.localizedMessage}")
        }
    }

    suspend fun updateProfile(request: UpdateProfileRequest): NetworkResult<ProfileResponse> = withContext(Dispatchers.IO) {
        try {
            val response = authApi.updateProfile(request)
            NetworkResult.Success(response)
        } catch (e: Exception) {
            NetworkResult.Error("Could not update profile: ${e.localizedMessage}")
        }
    }

    suspend fun deleteAccount(): NetworkResult<Unit> = withContext(Dispatchers.IO) {
        try {
            authApi.deleteAccount()
            signOut()
            NetworkResult.Success(Unit)
        } catch (e: Exception) {
            NetworkResult.Error("Could not delete account: ${e.localizedMessage}")
        }
    }

    suspend fun fetchMyOrders(): NetworkResult<List<UserOrder>> = withContext(Dispatchers.IO) {
        try {
            val response = authApi.getMyOrders()
            NetworkResult.Success(response.orders)
        } catch (e: Exception) {
            NetworkResult.Error("Could not load your orders: ${e.localizedMessage}")
        }
    }

    suspend fun fetchMyReports(): NetworkResult<MyReportsResponse> = withContext(Dispatchers.IO) {
        try {
            val response = authApi.getMyReports()
            NetworkResult.Success(response)
        } catch (e: Exception) {
            NetworkResult.Error("Could not load your reports: ${e.localizedMessage}")
        }
    }

    suspend fun deleteReport(id: Long, type: String?): NetworkResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = authApi.deleteReport(id, type)
            if (response.success) {
                NetworkResult.Success(Unit)
            } else {
                NetworkResult.Error(response.error ?: "Could not delete report")
            }
        } catch (e: Exception) {
            NetworkResult.Error("Delete report failed: ${e.localizedMessage}")
        }
    }

    suspend fun updateReport(id: Long, type: String?, request: UpdateReportRequest): NetworkResult<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = authApi.updateReport(id, type, request)
            if (response.success) {
                NetworkResult.Success(Unit)
            } else {
                NetworkResult.Error(response.error ?: "Could not update report")
            }
        } catch (e: Exception) {
            NetworkResult.Error("Update report failed: ${e.localizedMessage}")
        }
    }

    suspend fun syncGuestFavourites(visitorId: String): NetworkResult<Int> = withContext(Dispatchers.IO) {
        try {
            val response = authApi.syncFavourites(mapOf("visitorId" to visitorId))
            NetworkResult.Success(response.synced)
        } catch (e: Exception) {
            NetworkResult.Error("Could not sync favourites: ${e.localizedMessage}")
        }
    }
}
