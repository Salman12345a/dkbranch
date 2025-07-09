package com.dkbranch.socket.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.dkbranch.socket.service.OrderSocketService
import com.dkbranch.socket.data.EncryptedSharedPreferencesManager

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d("BootReceiver", "Boot completed, attempting to start OrderSocketService")
            // Use applicationContext for SharedPreferences to avoid leaks
            val appContext = context.applicationContext
            val prefsManager = EncryptedSharedPreferencesManager(appContext)
            val branchId = prefsManager.getBranchId(appContext)
            val token = prefsManager.getToken(appContext)
            val storeIsOpen = prefsManager.getStoreStatus(appContext) // Get store status

            if (branchId != null && token != null && storeIsOpen) { // Check storeIsOpen
                Log.d("BootReceiver", "Credentials and open store status found, starting service")
                val serviceIntent = Intent(appContext, OrderSocketService::class.java).apply {
                    putExtra("branchId", branchId)
                    putExtra("token", token)
                    // Add a flag to indicate this start is from boot, if needed by the service
                    putExtra("started_from_boot", true) 
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    appContext.startForegroundService(serviceIntent)
                } else {
                    appContext.startService(serviceIntent)
                }
            } else {
                if (branchId == null || token == null) {
                    Log.d("BootReceiver", "Credentials not found, service not started.")
                }
                if (!storeIsOpen) {
                    Log.d("BootReceiver", "Store status is closed, service not started.")
                }
            }
        }
    }
}