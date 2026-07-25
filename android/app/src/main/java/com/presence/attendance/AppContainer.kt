package com.presence.attendance

import android.content.Context
import com.presence.attendance.data.local.SettingsRepository
import com.presence.attendance.data.remote.ApiClient

class AppContainer(context: Context) {
    val settingsRepository = SettingsRepository(context)
    val apiClient = ApiClient(settingsRepository)
}
