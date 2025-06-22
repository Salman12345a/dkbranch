package com.dkbranch.socket

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.dkbranch.socket.data.AppDatabase
import com.dkbranch.socket.data.EncryptedSharedPreferencesManager
import com.dkbranch.socket.service.OrderSocketService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class OrderSocketModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val database = AppDatabase.getInstance(reactContext)
    private val encryptedPrefsManager = EncryptedSharedPreferencesManager(reactContext)
    private val socketManager = OrderSocketManager(database, encryptedPrefsManager)
    private val scope = CoroutineScope(Dispatchers.IO)

    init {
        socketManager.setEventEmitter { eventName, params ->
            sendEvent(eventName, params)
        }
    }

    override fun getName() = "OrderSocketModule"

    @ReactMethod
    fun setApiBaseUrl(apiBaseUrl: String, promise: Promise) {
        try {
            // Store the API base URL in the encrypted preferences
            encryptedPrefsManager.saveApiBaseUrl(reactApplicationContext, apiBaseUrl)
            socketManager.setApiBaseUrl(apiBaseUrl)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SET_API_URL_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun connect(branchId: String, token: String, promise: Promise) {
        try {
            encryptedPrefsManager.saveCredentials(reactApplicationContext, branchId, token)
            // When connecting, assume store should be open by default or respect last known state.
            // For simplicity now, let's ensure it's marked as open for service start.
            encryptedPrefsManager.saveStoreStatus(reactApplicationContext, true)

            // Configure socket manager first
            socketManager.setContext(reactApplicationContext)
            
            // Get socket URL from preferences or use default production URL
            val socketUrl = "https://dokirana.el.r.appspot.com/"
            socketManager.setSocketServerUrl(socketUrl)
            
            // Start the service with all required parameters
            val serviceIntent = Intent(reactApplicationContext, OrderSocketService::class.java).apply {
                putExtra("branchId", branchId)
                putExtra("token", token)
                putExtra("socketUrl", socketUrl)
                // Flag indicating service was started by user action, not boot
                putExtra("started_from_boot", false)
            }
            
            // Start or restart service
            reactApplicationContext.stopService(serviceIntent) // Stop if already running
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactApplicationContext.startForegroundService(serviceIntent)
        } else {
            reactApplicationContext.startService(serviceIntent)
        }
            
            // Also connect manager if needed (it will be connected by the service)
            if (!socketManager.isConnected()) {
                socketManager.connect(branchId, token)
            }
            
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CONNECT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            encryptedPrefsManager.clearCredentials(reactApplicationContext) // This will also clear store status
            // Explicitly mark store as closed for service control
            encryptedPrefsManager.saveStoreStatus(reactApplicationContext, false)

            val serviceIntent = Intent(reactApplicationContext, OrderSocketService::class.java)
            reactApplicationContext.stopService(serviceIntent)
            socketManager.disconnect()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DISCONNECT_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setStoreStatus(isOpen: Boolean, promise: Promise) {
        try {
            encryptedPrefsManager.saveStoreStatus(reactApplicationContext, isOpen)
            val branchId = encryptedPrefsManager.getBranchId(reactApplicationContext)
            val token = encryptedPrefsManager.getToken(reactApplicationContext)

            if (branchId != null && token != null) {
                if (isOpen) {
                    // Configure socket manager context
                    socketManager.setContext(reactApplicationContext)
                    
                    // Get socket URL (could be stored in preferences in a real implementation)
                    val socketUrl = "https://syncmart-ws.fly.dev"
                    socketManager.setSocketServerUrl(socketUrl)
                    
                    // Start the service with all required parameters
                    val serviceIntent = Intent(reactApplicationContext, OrderSocketService::class.java).apply {
                        putExtra("branchId", branchId)
                        putExtra("token", token)
                        putExtra("socketUrl", socketUrl)
                        // Flag indicating service was explicitly opened by user
                        putExtra("started_from_user", true)
                    }
                    
                    // Start or restart service
                    reactApplicationContext.stopService(serviceIntent) // Stop if already running
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactApplicationContext.startForegroundService(serviceIntent)
        } else {
            reactApplicationContext.startService(serviceIntent)
        }
                    
                    // Ensure socket manager is also connected
                    if (!socketManager.isConnected()) {
                         socketManager.connect(branchId, token)
                    }
                } else {
                    // Stop service and disconnect socket when store is closed
                    val serviceIntent = Intent(reactApplicationContext, OrderSocketService::class.java)
                    reactApplicationContext.stopService(serviceIntent)
                    socketManager.disconnect()
                }
            } else {
                // If no credentials, we can't start the service, but still save the desired status
                if (!isOpen) { // If trying to close and no creds, ensure service is stopped if it was somehow running
                     val serviceIntent = Intent(reactApplicationContext, OrderSocketService::class.java)
                     reactApplicationContext.stopService(serviceIntent)
                     socketManager.disconnect()
                }
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("SET_STORE_STATUS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getPersistedOrders(promise: Promise) {
        scope.launch {
            try {
                val branchId = encryptedPrefsManager.getBranchId(reactApplicationContext)
                if (branchId == null) {
                    promise.resolve(Arguments.createArray()) // No branchId, return empty array
                    return@launch
                }

                val orderList = database.orderDao().getOrdersForBranch(branchId).first() // Get the current list once
                val result = Arguments.createArray()
                
                orderList.forEach { order ->
                    val orderMap = Arguments.createMap().apply {
                        putString("orderId", order.orderId)
                        putString("branchId", order.branchId)
                        putString("orderData", order.orderData) // This is a JSON string
                        putString("status", order.status)
                        putDouble("createdAt", order.createdAt.toDouble()) // WritableMap uses double for numbers
                        putDouble("updatedAt", order.updatedAt.toDouble())
                    }
                    result.pushMap(orderMap)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("GET_PERSISTED_ORDERS_ERROR", "Error fetching persisted orders: ${e.message}", e)
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built in Event Emitter Calls.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built in Event Emitter Calls.
    }
}