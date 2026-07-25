package com.presence.attendance.ui.settings

import android.os.Build
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.presence.attendance.data.local.SettingsRepository
import com.presence.attendance.data.remote.ApiClient
import com.presence.attendance.data.remote.DeviceRegisterRequest
import com.presence.attendance.data.remote.LoginRequest
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settingsRepository: SettingsRepository,
    apiClient: ApiClient,
    onBack: () -> Unit,
) {
    val settings by settingsRepository.settings.collectAsState()
    val scope = rememberCoroutineScope()
    var apiUrl by remember(settings.apiUrl) { mutableStateOf(settings.apiUrl) }
    var email by remember { mutableStateOf("admin@presence.local") }
    var password by remember { mutableStateOf("Admin123!") }
    var branchCode by remember(settings.branchCode) { mutableStateOf(settings.branchCode) }
    var deviceName by remember(settings.deviceName) { mutableStateOf(settings.deviceName) }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Admin / Device", style = MaterialTheme.typography.titleLarge)

            OutlinedTextField(
                value = apiUrl,
                onValueChange = { apiUrl = it },
                label = { Text("API URL") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = branchCode,
                onValueChange = { branchCode = it },
                label = { Text("Branch code") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = deviceName,
                onValueChange = { deviceName = it },
                label = { Text("Device name") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Admin email") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Admin password") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            RowToggle(
                label = "Auto sync",
                checked = settings.autoSync,
                onCheckedChange = { checked ->
                    settingsRepository.update { it.copy(autoSync = checked) }
                },
            )
            RowToggle(
                label = "Offline mode",
                checked = settings.offlineMode,
                onCheckedChange = { checked ->
                    settingsRepository.update { it.copy(offlineMode = checked) }
                },
            )
            RowToggle(
                label = "Kiosk mode",
                checked = settings.kioskMode,
                onCheckedChange = { checked ->
                    settingsRepository.update { it.copy(kioskMode = checked) }
                },
            )

            Button(
                enabled = !busy,
                onClick = {
                    settingsRepository.update {
                        it.copy(
                            apiUrl = apiUrl.trim(),
                            branchCode = branchCode.trim().uppercase(),
                            deviceName = deviceName.trim(),
                        )
                    }
                    message = "Settings saved locally"
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Save settings")
            }

            Button(
                enabled = !busy,
                onClick = {
                    scope.launch {
                        busy = true
                        message = "Signing in…"
                        try {
                            settingsRepository.update { it.copy(apiUrl = apiUrl.trim()) }
                            val login = apiClient.api().login(LoginRequest(email.trim(), password))
                            val token = login.data?.token
                            if (login.success && !token.isNullOrBlank()) {
                                settingsRepository.update { it.copy(authToken = token) }
                                message = "Login OK — token stored"
                            } else {
                                message = login.message ?: "Login failed"
                            }
                        } catch (e: Exception) {
                            message = "Login error: ${e.message}"
                        } finally {
                            busy = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Login to server")
            }

            Button(
                enabled = !busy,
                onClick = {
                    scope.launch {
                        busy = true
                        message = "Registering device…"
                        try {
                            settingsRepository.update {
                                it.copy(
                                    apiUrl = apiUrl.trim(),
                                    branchCode = branchCode.trim().uppercase(),
                                    deviceName = deviceName.trim(),
                                )
                            }
                            val current = settingsRepository.settings.value
                            val response = apiClient.api().registerDevice(
                                DeviceRegisterRequest(
                                    deviceId = current.deviceId.ifBlank { "TAB001" },
                                    name = current.deviceName,
                                    branchCode = current.branchCode,
                                    model = Build.MODEL,
                                    osVersion = Build.VERSION.RELEASE,
                                ),
                            )
                            val device = response.data?.device
                            if (response.success && device != null) {
                                settingsRepository.update {
                                    it.copy(
                                        deviceId = device.deviceId ?: it.deviceId,
                                        organizationName = device.branch?.organizationName
                                            ?: it.organizationName,
                                        branchName = device.branch?.name ?: it.branchName,
                                        branchCode = device.branch?.code ?: it.branchCode,
                                        kioskMode = device.kioskMode ?: it.kioskMode,
                                    )
                                }
                                message = "Device registered: ${device.deviceId}"
                            } else {
                                message = response.message ?: "Device registration failed"
                            }
                        } catch (e: Exception) {
                            message = "Register error: ${e.message}"
                        } finally {
                            busy = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Register this device")
            }

            if (message.isNotBlank()) {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            Text(
                text = "Token: ${if (settings.authToken.isBlank()) "not set" else "saved (encrypted)"}",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                text = "Device ID: ${settings.deviceId.ifBlank { "—" }}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun RowToggle(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}
