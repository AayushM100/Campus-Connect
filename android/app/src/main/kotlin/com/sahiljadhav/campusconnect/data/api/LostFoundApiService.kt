package com.sahiljadhav.campusconnect.data.api

import com.sahiljadhav.campusconnect.data.model.LostFoundItem
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

interface LostFoundApiService {
    @GET("api/lost-found/lost")
    suspend fun getLostItems(): List<LostFoundItem>

    @GET("api/lost-found/found")
    suspend fun getFoundItems(): List<LostFoundItem>

    @Multipart
    @POST("api/lost-found")
    suspend fun reportItem(
        @Part("item_name") itemName: RequestBody,
        @Part("status") status: RequestBody,
        @Part("location") location: RequestBody,
        @Part("description") description: RequestBody,
        @Part("person_name") personName: RequestBody,
        @Part("roll_number") rollNumber: RequestBody,
        @Part("contact_number") contactNumber: RequestBody,
        @Part image: MultipartBody.Part? = null
    ): Map<String, Any>
}
