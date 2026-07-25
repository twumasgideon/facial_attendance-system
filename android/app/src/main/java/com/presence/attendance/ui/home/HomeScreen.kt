package com.presence.attendance.ui.home

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.presence.attendance.data.local.SettingsRepository
import com.presence.attendance.ui.components.HomeActionButton
import com.presence.attendance.ui.components.StatusChip
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private data class HomeAction(
    val title: String,
    val subtitle: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val onClick: () -> Unit,
)

@Composable
fun HomeScreen(
    settingsRepository: SettingsRepository,
    onClockIn: () -> Unit,
    onSettings: () -> Unit,
    onPeople: () -> Unit,
    onSync: () -> Unit,
    onStatus: () -> Unit,
) {
    val context = LocalContext.current
    val settings by settingsRepository.settings.collectAsState()
    var now by remember { mutableStateOf(Date()) }
    var networkLabel by remember { mutableStateOf(networkStatus(context)) }
    var batteryLabel by remember { mutableStateOf(batteryPercent(context)) }
    val deviceId = remember {
        settings.deviceId.ifBlank {
            "TAB-" + Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                ?.takeLast(6)
                ?.uppercase(Locale.US)
                .orEmpty()
        }
    }

    LaunchedEffect(Unit) {
        if (settings.deviceId.isBlank()) {
            settingsRepository.update { it.copy(deviceId = deviceId) }
        }
        while (true) {
            now = Date()
            networkLabel = networkStatus(context)
            batteryLabel = batteryPercent(context)
            delay(1_000)
        }
    }

    val dateFmt = remember { SimpleDateFormat("EEEE, MMM d, yyyy", Locale.getDefault()) }
    val timeFmt = remember { SimpleDateFormat("HH:mm:ss", Locale.getDefault()) }

    val actions = listOf(
        HomeAction("Clock In / Out", "Face recognition attendance", Icons.Filled.Face, onClockIn),
        HomeAction("Registered People", "Browse synced employees", Icons.Filled.Groups, onPeople),
        HomeAction("Face Synchronization", "Pull users from server", Icons.Filled.CloudSync, onSync),
        HomeAction("Settings", "Camera, sync, device config", Icons.Filled.Settings, onSettings),
        HomeAction("System Status", "Network, sync, device health", Icons.Filled.Info, onStatus),
        HomeAction("Power Menu", "Exit or restart kiosk", Icons.Filled.PowerSettingsNew) {
            (context as? android.app.Activity)?.finishAffinity()
        },
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
    ) {
        Text(
            text = settings.organizationName,
            style = MaterialTheme.typography.headlineMedium.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
            ),
        )
        Text(
            text = settings.branchName,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary,
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = timeFmt.format(now),
            style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.SemiBold),
        )
        Text(
            text = dateFmt.format(now),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
        )
        Spacer(modifier = Modifier.height(16.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            StatusChip(label = "Network", value = networkLabel)
            StatusChip(label = "Battery", value = batteryLabel)
            StatusChip(label = "Sync", value = if (settings.autoSync) "Auto" else "Manual")
            StatusChip(label = "Device", value = deviceId)
        }
        Spacer(modifier = Modifier.height(24.dp))
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 220.dp),
            contentPadding = PaddingValues(bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.fillMaxSize(),
        ) {
            items(actions) { action ->
                HomeActionButton(
                    title = action.title,
                    subtitle = action.subtitle,
                    icon = action.icon,
                    onClick = action.onClick,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

private fun networkStatus(context: Context): String {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val network = cm.activeNetwork ?: return "Offline"
    val caps = cm.getNetworkCapabilities(network) ?: return "Offline"
    return when {
        caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "Wi-Fi"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "Ethernet"
        caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "Cellular"
        else -> "Online"
    }
}

private fun batteryPercent(context: Context): String {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        "$pct%"
    } else {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        if (level >= 0 && scale > 0) "${level * 100 / scale}%" else "--"
    }
}
