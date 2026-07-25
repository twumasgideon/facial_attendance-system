package com.presence.attendance.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Navy = Color(0xFF0F172A)
private val Slate = Color(0xFF1E293B)
private val Blue = Color(0xFF0B5FFF)
private val Mist = Color(0xFFF8FAFC)
private val Ink = Color(0xFF0B1220)

private val DarkColors = darkColorScheme(
    primary = Blue,
    onPrimary = Color.White,
    background = Navy,
    onBackground = Mist,
    surface = Slate,
    onSurface = Mist,
    secondary = Color(0xFF38BDF8),
    onSecondary = Ink,
)

private val LightColors = lightColorScheme(
    primary = Blue,
    onPrimary = Color.White,
    background = Mist,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    secondary = Color(0xFF0369A1),
    onSecondary = Color.White,
)

@Composable
fun PresenceTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
