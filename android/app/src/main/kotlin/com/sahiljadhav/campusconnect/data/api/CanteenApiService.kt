package com.sahiljadhav.campusconnect.data.api

import com.sahiljadhav.campusconnect.data.model.Canteen
import com.sahiljadhav.campusconnect.data.model.MenuItem
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.POST
import retrofit2.http.Path

interface CanteenApiService {
    @GET("api/canteens")
    suspend fun getCanteens(): List<Canteen>

    @GET("api/menu")
    suspend fun getAllMenu(): List<MenuItem>

    @GET("api/menu/{canteen}")
    suspend fun getMenuByCanteen(@Path("canteen") canteen: String): List<MenuItem>

    @GET("api/campus-picks")
    suspend fun getCampusPicks(): List<MenuItem>

    @GET("api/favourites/top")
    suspend fun getTopFavourite(): MenuItem

    @GET("api/favourites/{visitorId}")
    suspend fun getFavourites(@Path("visitorId") visitorId: String): List<Map<String, Any>>

    @POST("api/favourites")
    suspend fun addFavourite(@Body body: Map<String, Any>): Map<String, Any>

    @HTTP(method = "DELETE", path = "api/favourites", hasBody = true)
    suspend fun removeFavourite(@Body body: Map<String, Any>): Map<String, Any>
}
