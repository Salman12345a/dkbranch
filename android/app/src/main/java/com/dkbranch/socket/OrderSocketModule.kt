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
    // Use lazy to defer heavy I/O initialization off the main thread
    private val database by lazy { AppDatabase.getInstance(reactContext) }
    private val encryptedPrefsManager by lazy { EncryptedSharedPreferencesManager(reactContext) }
    private val socketManager by lazy { OrderSocketManager(database, encryptedPrefsManager) }
    private val scope = CoroutineScope(Dispatchers.IO)

    // Event emitter setup deferred to first use via lazy socketManager

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
            encryptedPrefsManager.saveStoreStatus(reactApplicationContext, true)

            // Wire up event emitter on first use (socketManager is lazy)
            socketManager.setEventEmitter { eventName, params ->
                sendEvent(eventName, params)
            }

            // Configure socket manager context and URL
            socketManager.setContext(reactApplicationContext)
            socketManager.setSocketServerUrl(SOCKET_SERVER_URL)

            // Build service intent with all required extras
            val serviceIntent = Intent(reactApplicationContext, OrderSocketService::class.java).apply {
                putExtra("branchId", branchId)
                putExtra("token", token)
                putExtra("socketUrl", SOCKET_SERVER_URL)
                putExtra("started_from_boot", false)
            }

            // Stop any existing instance before starting a fresh one
            reactApplicationContext.stopService(serviceIntent)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(serviceIntent)
            } else {
                reactApplicationContext.startService(serviceIntent)
            }

            // Note: Do NOT call socketManager.connect() here.
            // The OrderSocketService.onStartCommand() calls it after the service is started,
            // preventing duplicate WebSocket connections.

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
    fun getRecentOrders(branchId: String, promise: Promise) {
        scope.launch {
            try {
                val orderList = database.orderDao().getOrdersForBranch(branchId).first()
                val result = Arguments.createArray()
                orderList.forEach { order ->
                    val orderMap = Arguments.createMap().apply {
                        putString("orderId", order.orderId)
                        putString("branchId", order.branchId)
                        putString("orderData", order.orderData)
                        putString("status", order.status)
                        putDouble("createdAt", order.createdAt.toDouble())
                        putDouble("updatedAt", order.updatedAt.toDouble())
                    }
                    result.pushMap(orderMap)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("GET_RECENT_ORDERS_ERROR", "Error fetching recent orders: ${e.message}", e)
            }
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

    companion object {
        // Single source of truth for the WebSocket server URL in native code.
        // The JS side sets this via setApiBaseUrl(); keep in sync with src/config.ts SOCKET_URL.
        private const val SOCKET_SERVER_URL = "https://dokirana.el.r.appspot.com/"
    }
}