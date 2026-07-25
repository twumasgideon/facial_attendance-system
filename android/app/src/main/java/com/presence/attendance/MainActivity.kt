package com.presence.attendance

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.presence.attendance.navigation.PresenceNavHost
import com.presence.attendance.ui.theme.PresenceTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as PresenceApp).container
        setContent {
            PresenceTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    PresenceNavHost(container = container)
                }
            }
        }
    }
}
