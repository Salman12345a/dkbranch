package com.dkbranch.socket

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.PowerManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.dkbranch.socket.data.AppDatabase
import com.dkbranch.socket.data.OrderEntity
import com.dkbranch.socket.data.EncryptedSharedPreferencesManager
import com.facebook.react.bridge.WritableArray
import org.json.JSONArray
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class OrderSocketManager(private val database: AppDatabase, private val encryptedPrefsManager: EncryptedSharedPreferencesManager) {
    private var webSocket: WebSocket? = null
    // Changed from lateinit to nullable — prevents UninitializedPropertyAccessException on boot-restart
    private var context: Context? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val WAKE_LOCK_TAG = "OrderSocketManager::WakeLock"
    
    // Improved OkHttp client with better timeout and keep-alive settings
    // JSON to WritableMap/Array helpers (consider moving to a utility class)
    private fun convertJsonToMap(jsonObject: JSONObject): WritableMap {
        val map = Arguments.createMap()
        jsonObject.keys().forEach { key ->
            when (val value = jsonObject.get(key)) {
                is JSONObject -> map.putMap(key, convertJsonToMap(value))
                is JSONArray -> map.putArray(key, convertJsonToArray(value))
                is Boolean -> map.putBoolean(key, value)
                is Int -> map.putInt(key, value)
                is Long -> map.putDouble(key, value.toDouble()) // WritableMap no putLong
                is Double -> map.putDouble(key, value)
                is String -> map.putString(key, value)
                else -> map.putNull(key)
            }
        }
        return map
    }

    private fun convertJsonToArray(jsonArray: JSONArray): WritableArray {
        val array = Arguments.createArray()
        for (i in 0 until jsonArray.length()) {
            when (val value = jsonArray.get(i)) {
                is JSONObject -> array.pushMap(convertJsonToMap(value))
                is JSONArray -> array.pushArray(convertJsonToArray(value))
                is Boolean -> array.pushBoolean(value)
                is Int -> array.pushInt(value)
                is Long -> array.pushDouble(value.toDouble()) // WritableArray no pushLong
                is Double -> array.pushDouble(value)
                is String -> array.pushString(value)
                else -> array.pushNull()
            }
        }
        return array
    }

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)  // No timeout for WebSocket
        .writeTimeout(30, TimeUnit.SECONDS)     // Reasonable write timeout
        .connectTimeout(15, TimeUnit.SECONDS)   // Connection timeout
        .pingInterval(15, TimeUnit.SECONDS)     // More frequent pings for keep-alive
        .retryOnConnectionFailure(true)         // Auto retry connections
        .build()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob()) // SupervisorJob for better error handling
    private val orderChannel = Channel<JSONObject>(Channel.BUFFERED)
    
    private var isConnected = false
    private var isConnecting = false
    private var reconnectAttempts = 0
    private val maxReconnectAttempts = 30 // Increased max reconnect attempts
    private var currentBranchId: String? = null
    private var connectionJob: Job? = null
    
    private var eventEmitter: ((String, WritableMap) -> Unit)? = null
    private var currentToken: String? = null
    
    // Socket server URL - should be configured from the React Native side
    private var socketServerUrl = "https://dokirana.el.r.appspot.com/" // Default socket URL
    
    // API base URL for REST requests - configured from React Native side
    private var apiBaseUrl = "https://dokirana.el.r.appspot.com/api" // Default API URL

    fun setContext(context: Context) {
        this.context = context.applicationContext // Use application context
    }
    
    fun setEventEmitter(emitter: (String, WritableMap) -> Unit) {
        eventEmitter = emitter
    }

    fun setToken(token: String) {
        currentToken = token
    }
    
    fun setSocketServerUrl(url: String) {
        socketServerUrl = url
        Log.d(TAG, "Socket server URL set to: $url")
    }
    
    fun setApiBaseUrl(url: String) {
        this.apiBaseUrl = url
    }
    
    fun getApiBaseUrl(): String {
        return apiBaseUrl
    }

    fun isConnected(): Boolean {
        return isConnected
    }
    
    private fun acquireWakeLock() {
        Log.d(TAG, "Attempting to acquire WakeLock...")
        try {
            context?.let { ctx ->
                if (wakeLock == null) {
                    val powerManager = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
                    wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "DKBranch:OrderSocketWakeLock"
                    )
                    wakeLock?.setReferenceCounted(false)
                }
                
                if (wakeLock?.isHeld == false) {
                    wakeLock?.acquire(30 * 60 * 1000L) // 30 minutes max
                    Log.d(TAG, "WakeLock acquired")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error acquiring WakeLock: ${e.message}", e)
        }
    }
    
    private fun releaseWakeLock() {
        Log.d(TAG, "Attempting to release WakeLock...")
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "WakeLock released")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing WakeLock: ${e.message}", e)
        }
    }
    
    private fun isNetworkAvailable(): Boolean {
        context?.let { ctx ->
            val connectivityManager = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = connectivityManager.activeNetwork ?: return false
                val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
                return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            } else {
                @Suppress("DEPRECATION")
                val networkInfo = connectivityManager.activeNetworkInfo
                @Suppress("DEPRECATION")
                return networkInfo != null && networkInfo.isConnected
            }
        }
        return false
    }

    fun connect(branchId: String, token: String) {
        Log.i(TAG, "connect() called with branchId: $branchId, token: ${token.take(10)}...")
        if (context == null) {
            Log.e(TAG, "Context not set. Call setContext() before connecting.")
            eventEmitter?.invoke("error", Arguments.createMap().apply { putString("message", "Context not set in OrderSocketManager") })
            return
        }

        // Check store status before connecting
        if (!encryptedPrefsManager.getStoreStatus(context!!)) {
            Log.i(TAG, "Store is closed. Socket connection not initiated.")
            eventEmitter?.invoke("error", Arguments.createMap().apply { putString("message", "Store is closed. Cannot connect socket.") })
            return
        }

        if (isConnected || isConnecting) {
            Log.d(TAG, "Already connected or connecting.")
            return
        }
        
        // Clean up existing connection if any
        if (webSocket != null) {
            Log.d(TAG, "Socket already exists, cleaning up before reconnection")
            webSocket?.close(1000, "Reconnecting")
            webSocket = null
        }
        
        // Cancel any existing reconnection job
        connectionJob?.cancel()
        
        // Acquire wake lock to keep CPU active for socket connection
        acquireWakeLock()
        
        // Start connection in background thread
        connectionJob = scope.launch {
            try {
                isConnecting = true
                Log.d(TAG, "Starting new socket connection")
                
                // Check network availability first
                if (!isNetworkAvailable()) {
                    Log.d(TAG, "Network unavailable, scheduling retry")
                    delay(5000) // Wait 5 seconds before retry
                    isConnecting = false
                    handleReconnection(branchId)
                    return@launch
                }
                
                val request = Request.Builder()
                    .url(socketServerUrl)
                    .addHeader("Authorization", "Bearer $token")
                    .build()

                Log.i(TAG, "Attempting to connect to: $socketServerUrl")
                
                webSocket = client.newWebSocket(request, object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        Log.i(TAG, "WebSocket connection opened. Response: ${response.message}")
                        Log.d(TAG, "Socket Connected Successfully")
                        isConnected = true
                        isConnecting = false
                        reconnectAttempts = 0
                        
                        // Send keep-alive ping immediately
                        sendKeepAlivePing()
                        
                        try {
                            // Join branch room
                            val joinPayload = JSONObject().apply {
                                put("branchId", branchId)
                                put("token", token)
                            }
                            val branchRoom = "branch_${branchId}"
        val branchPayload = JSONObject().apply { put("roomId", branchRoom) }
        socketEmit("joinRoom", branchPayload)
                            Log.d(TAG, "Join branch message sent for: $branchId")

                            // Join existing order rooms from database
                            scope.launch {
                                try {
                                    database.orderDao().getOrdersForBranch(branchId).collect { orders ->
                                        orders.forEach { order ->
                                            val roomPayload = JSONObject().apply { put("roomId", order.orderId) }
                                            socketEmit("joinRoom", roomPayload)
                                            Log.d(TAG, "Joined existing order room: ${order.orderId}")
                                        }
                                    }
                                } catch (e: Exception) {
                                    Log.e(TAG, "Error joining order rooms: ${e.message}")
                                }
                            }
                            
                            // Start heartbeat mechanism
                            startHeartbeat()
                            
                        } catch (e: Exception) {
                            Log.e(TAG, "Error in onOpen: ${e.message}")
                        }
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                    // Handle Engine.IO control packets
                    if (text == "2") {
                        // Server ping – respond with pong
                        webSocket.send("3")
                        return
                    }
                    if (text == "3" || text.startsWith("0")) {
                        return // ignore heartbeats / connect packets
                    }

                    var payloadText = text
                    var event: String? = null
                    var dataObject: JSONObject? = null

                    // Socket.IO message packets start with 42
                    if (text.startsWith("42")) {
                        val jsonPart = text.substring(2)
                        try {
                            val arr = JSONArray(jsonPart)
                            if (arr.length() > 0) {
                                event = arr.getString(0)
                            }
                            if (arr.length() > 1) {
                                dataObject = arr.getJSONObject(1)
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to parse socket.io frame: ${e.message}")
                        }
                    } else {
                        // Fallback: treat whole text as JSON (old behaviour)
                        try {
                            val messageJson = JSONObject(text)
                            event = messageJson.optString("event")
                            dataObject = messageJson.optJSONObject("data") ?: messageJson
                        } catch (e: Exception) {
                            Log.e(TAG, "Unrecognised message: $text")
                        }
                    }

                    if (event == null || dataObject == null) return
                        Log.d(TAG, "WebSocket message received (raw): $text")
                        Log.d(TAG, "Receiving: $text")
                        try {
                            val messageJson = JSONObject(text)
                            val event = messageJson.optString("event")
                            val dataObject = messageJson.optJSONObject("data") ?: messageJson // Fallback if data is not nested

                            if (event == "newOrder" || event == "orderStatusUpdate" || event == "orderModified") {
                                scope.launch {
                                    try {
                                        val orderId = dataObject.optString("orderId", dataObject.optString("_id"))
                                        val currentBranchId = getBranchIdFromToken()
                                        val status = dataObject.optString("status", "Pending")

                                        if (orderId.isNotEmpty() && currentBranchId != null) {
                                            val orderEntity = OrderEntity(
                                                orderId = orderId,
                                                branchId = currentBranchId,
                                                orderData = dataObject.toString(),
                                                status = status,
                                                createdAt = dataObject.optLong("createdAt", System.currentTimeMillis()),
                                                updatedAt = dataObject.optLong("updatedAt", System.currentTimeMillis())
                                            )
                                            // insertOrder will update if orderId (PrimaryKey) exists
                                            database.orderDao().insertOrder(orderEntity)
                                            Log.i(TAG, "Order $orderId processed and saved/updated in database.")

                                            if (event == "newOrder") {
                                                // Join room for the new order
                                                val joinRoomData = JSONObject().apply {
                                                    put("event", "joinRoom")
                                                    put("roomId", orderId)
                                                }
                                                this@OrderSocketManager.webSocket?.send(joinRoomData.toString())
                                                Log.i(TAG, "Sent joinRoom for new order $orderId")
                                            }

                                            // Emit event to service/RN after saving/updating and joining room
                                            val params = Arguments.createMap()
                                            dataObject.keys()?.forEach {
                                                when (val value = dataObject.get(it)) {
                                                    is String -> params.putString(it, value)
                                                    is Int -> params.putInt(it, value)
                                                    is Boolean -> params.putBoolean(it, value)
                                                    is Double -> params.putDouble(it, value)
                                                    is Long -> params.putDouble(it, value.toDouble())
                                                    is JSONObject -> params.putMap(it, convertJsonToMap(value))
                                                    is JSONArray -> params.putArray(it, convertJsonToArray(value))
                                                }
                                            }
                                            eventEmitter?.invoke(event, params)
                                        } else {
                                            Log.w(TAG, "Missing orderId or branchId in $event message. Cannot process.")
                                        }
                                    } catch (e: Exception) {
                                        Log.e(TAG, "Error processing and saving order $event: ${e.message}", e)
                                    }
                                }
                            } else {
                                // Handle other events (like joinedBranch, pong, etc.)
                                val params = Arguments.createMap()
                                dataObject?.keys()?.forEach {
                                     when (val value = dataObject.get(it)) {
                                        is String -> params.putString(it, value)
                                        is Int -> params.putInt(it, value)
                                        is Boolean -> params.putBoolean(it, value)
                                        is Double -> params.putDouble(it, value)
                                        is Long -> params.putDouble(it, value.toDouble())
                                        is JSONObject -> params.putMap(it, convertJsonToMap(value))
                                        is JSONArray -> params.putArray(it, convertJsonToArray(value))
                                    }
                                }
                                eventEmitter?.invoke(event, params)
                            }

                        } catch (e: Exception) {
                            Log.e(TAG, "Error parsing message: ${e.message}")
                        }
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        Log.w(TAG, "WebSocket connection closed. Code: $code, Reason: $reason")
                        Log.d(TAG, "Socket Closed: $code - $reason")
                        isConnected = false
                        isConnecting = false
                        handleReconnection(branchId)
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        Log.e(TAG, "WebSocket connection failure. Error: ${t.message}, Response: ${response?.message}", t)
                        Log.e(TAG, "Socket Failure: ${t.message}")
                        isConnected = false
                        isConnecting = false
                        handleReconnection(branchId)
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "Error creating socket connection: ${e.message}")
                isConnecting = false
                handleReconnection(branchId)
            }
        }
    }
    
    // Send custom ping to keep connection alive
    // Helper to get branchId from token (assuming it's stored in token)
    private fun getBranchIdFromToken(): String? {
        val ctx = context ?: return null
        return encryptedPrefsManager.getBranchId(ctx)
    }

    private fun sendKeepAlivePing() {
    // Socket.IO ping for Engine.IO v4 is just "2"
    if (isConnected && webSocket != null) {
        webSocket?.send("2")
    }
}
    
    // Start periodic heartbeat to keep connection alive
    private fun startHeartbeat() {
        scope.launch {
            while (isActive && isConnected) {
                try {
                    sendKeepAlivePing()
                    delay(25000) // Send ping every 25 seconds
                } catch (e: Exception) {
                    Log.e(TAG, "Heartbeat error: ${e.message}")
                }
            }
        }
    }

    private fun handleReconnection(branchId: String) {
        if (reconnectAttempts >= maxReconnectAttempts) {
            Log.e(TAG, "Max reconnection attempts ($maxReconnectAttempts) reached, giving up")
            releaseWakeLock()
            return
        }

        reconnectAttempts++
        // Exponential backoff: 1s, 2s, 4s … capped at 30s
        val delayTime = minOf(reconnectAttempts * 1000L, 30000L)
        Log.d(TAG, "Scheduling reconnection attempt $reconnectAttempts after ${delayTime}ms")

        connectionJob?.cancel()
        connectionJob = scope.launch {
            delay(delayTime)
            if (!isActive) return@launch

            if (isNetworkAvailable()) {
                Log.d(TAG, "Network available, attempting reconnection")
                currentToken?.let { token -> connect(branchId, token) }
            } else {
                Log.d(TAG, "Network still unavailable at attempt $reconnectAttempts, scheduling next attempt")
                // Don't recurse — just schedule via a new delayed coroutine
                delay(delayTime)
                if (isActive && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++
                    currentToken?.let { token -> connect(branchId, token) }
                }
            }
        }
    }


    private fun socketEmit(event: String, data: JSONObject? = null) {
        val arr = JSONArray().apply {
            put(event)
            data?.let { put(it) }
        }
        webSocket?.send("42$arr")
    }

    fun emit(event: String, data: JSONObject) {
        if (isConnected && webSocket != null) {
            try {
                socketEmit(event, data)
            } catch (e: Exception) {
                Log.e(TAG, "Error emitting event: ${e.message}")
            }
        } else {
            Log.w(TAG, "Cannot emit $event - socket not connected")
        }
    }

    fun disconnect() {
        Log.d(TAG, "Disconnecting socket")
        try {
            // Cancel any pending connection/reconnection job
            connectionJob?.cancel()
            
            // Close the websocket properly
            webSocket?.close(1000, "Normal closure")
            webSocket = null
            isConnected = false
            isConnecting = false
            
            // Release wake lock
            releaseWakeLock()
            
            // Reset state
            currentBranchId = null
        } catch (e: Exception) {
            Log.e(TAG, "Error during disconnect: ${e.message}")
        }
    }

    companion object {
        private const val TAG = "OrderSocketManager"
    }
} 