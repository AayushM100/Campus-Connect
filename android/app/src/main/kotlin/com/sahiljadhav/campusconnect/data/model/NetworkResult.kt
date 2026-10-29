package com.sahiljadhav.campusconnect.data.model

sealed class NetworkResult<out T> {
    data object Loading : NetworkResult<Nothing>()
    data class Success<out T>(val data: T) : NetworkResult<T>()
    data class Error(val message: String, val isColdStart: Boolean = false) : NetworkResult<Nothing>()
}
