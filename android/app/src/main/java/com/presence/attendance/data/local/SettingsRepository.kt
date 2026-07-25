package com.presence.attendance.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.presence.attendance.BuildConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AppSettings(
    val apiUrl: String = BuildConfig.DEFAULT_API_URL,
    val authToken: String = "",
    val deviceId: String = "",
    val deviceName: String = "Presence Tablet",
    val branchCode: String = "HQ01",
    val organizationName: String = "Presence Demo Org",
    val branchName: String = "Sofoline",
    val recognitionThreshold: Float = 0.7f,
    val autoSync: Boolean = true,
    val offlineMode: Boolean = true,
    val kioskMode: Boolean = true,
)

class SettingsRepository(context: Context) {
    private val prefs: SharedPreferences = createPrefs(context)
    private val _settings = MutableStateFlow(read())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private fun createPrefs(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                "presence_secure_settings",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } catch (_: Exception) {
            context.getSharedPreferences("presence_settings_fallback", Context.MODE_PRIVATE)
        }
    }

    private fun read(): AppSettings = AppSettings(
        apiUrl = prefs.getString(KEY_API_URL, BuildConfig.DEFAULT_API_URL) ?: BuildConfig.DEFAULT_API_URL,
        authToken = prefs.getString(KEY_TOKEN, "") ?: "",
        deviceId = prefs.getString(KEY_DEVICE_ID, "") ?: "",
        deviceName = prefs.getString(KEY_DEVICE_NAME, "Presence Tablet") ?: "Presence Tablet",
        branchCode = prefs.getString(KEY_BRANCH_CODE, "HQ01") ?: "HQ01",
        organizationName = prefs.getString(KEY_ORG, "Presence Demo Org") ?: "Presence Demo Org",
        branchName = prefs.getString(KEY_BRANCH_NAME, "Sofoline") ?: "Sofoline",
        recognitionThreshold = prefs.getFloat(KEY_THRESHOLD, 0.7f),
        autoSync = prefs.getBoolean(KEY_AUTO_SYNC, true),
        offlineMode = prefs.getBoolean(KEY_OFFLINE, true),
        kioskMode = prefs.getBoolean(KEY_KIOSK, true),
    )

    fun update(transform: (AppSettings) -> AppSettings) {
        val next = transform(_settings.value)
        prefs.edit()
            .putString(KEY_API_URL, next.apiUrl)
            .putString(KEY_TOKEN, next.authToken)
            .putString(KEY_DEVICE_ID, next.deviceId)
            .putString(KEY_DEVICE_NAME, next.deviceName)
            .putString(KEY_BRANCH_CODE, next.branchCode)
            .putString(KEY_ORG, next.organizationName)
            .putString(KEY_BRANCH_NAME, next.branchName)
            .putFloat(KEY_THRESHOLD, next.recognitionThreshold)
            .putBoolean(KEY_AUTO_SYNC, next.autoSync)
            .putBoolean(KEY_OFFLINE, next.offlineMode)
            .putBoolean(KEY_KIOSK, next.kioskMode)
            .apply()
        _settings.value = next
    }

    companion object {
        private const val KEY_API_URL = "api_url"
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_NAME = "device_name"
        private const val KEY_BRANCH_CODE = "branch_code"
        private const val KEY_ORG = "organization_name"
        private const val KEY_BRANCH_NAME = "branch_name"
        private const val KEY_THRESHOLD = "recognition_threshold"
        private const val KEY_AUTO_SYNC = "auto_sync"
        private const val KEY_OFFLINE = "offline_mode"
        private const val KEY_KIOSK = "kiosk_mode"
    }
}
