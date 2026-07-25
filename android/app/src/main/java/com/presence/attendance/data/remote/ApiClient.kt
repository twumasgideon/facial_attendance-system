package com.presence.attendance.data.remote

import com.presence.attendance.data.local.SettingsRepository
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.flow.first
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val message: String? = null,
)

data class LoginRequest(val email: String, val password: String)

data class LoginData(
    val token: String,
    val user: UserDto,
)

data class UserDto(
    val id: String? = null,
    val employeeId: String? = null,
    val fullName: String? = null,
    val email: String? = null,
    val role: String? = null,
)

data class DeviceRegisterRequest(
    val deviceId: String,
    val name: String,
    val branchCode: String,
    val platform: String = "ANDROID",
    val model: String = "",
    val osVersion: String = "",
    val appVersion: String = "1.0.0",
)

data class DeviceBranchDto(
    val id: String? = null,
    val code: String? = null,
    val name: String? = null,
    val organizationName: String? = null,
)

data class DeviceDto(
    val id: String? = null,
    val deviceId: String? = null,
    val name: String? = null,
    val platform: String? = null,
    val branch: DeviceBranchDto? = null,
    val kioskMode: Boolean? = null,
    val isAuthorized: Boolean? = null,
)

data class DeviceRegisterData(val device: DeviceDto)

interface PresenceApi {
    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): ApiResponse<LoginData>

    @POST("devices/register")
    suspend fun registerDevice(@Body body: DeviceRegisterRequest): ApiResponse<DeviceRegisterData>

    @GET("auth/me")
    suspend fun me(): ApiResponse<Map<String, Any?>>
}

class ApiClient(private val settingsRepository: SettingsRepository) {
    private val moshi: Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val authInterceptor = Interceptor { chain ->
        val token = settingsRepository.settings.value.authToken
        val request = if (token.isNotBlank()) {
            chain.request().newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            chain.request()
        }
        chain.proceed(request)
    }

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(authInterceptor)
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            },
        )
        .build()

    fun api(): PresenceApi {
        val base = settingsRepository.settings.value.apiUrl.trimEnd('/') + "/"
        return Retrofit.Builder()
            .baseUrl(base)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(PresenceApi::class.java)
    }
}
