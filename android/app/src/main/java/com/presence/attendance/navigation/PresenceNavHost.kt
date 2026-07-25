package com.presence.attendance.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.presence.attendance.AppContainer
import com.presence.attendance.ui.clock.ClockInScreen
import com.presence.attendance.ui.home.HomeScreen
import com.presence.attendance.ui.settings.SettingsScreen

object Routes {
    const val HOME = "home"
    const val CLOCK = "clock"
    const val SETTINGS = "settings"
    const val PEOPLE = "people"
    const val SYNC = "sync"
    const val STATUS = "status"
}

@Composable
fun PresenceNavHost(container: AppContainer) {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.HOME) {
            HomeScreen(
                settingsRepository = container.settingsRepository,
                onClockIn = { navController.navigate(Routes.CLOCK) },
                onSettings = { navController.navigate(Routes.SETTINGS) },
                onPeople = { /* P3 */ },
                onSync = { /* P2 */ },
                onStatus = { /* P2 */ },
            )
        }
        composable(Routes.CLOCK) {
            ClockInScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(
                settingsRepository = container.settingsRepository,
                apiClient = container.apiClient,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
