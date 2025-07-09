package com.dkbranch.socket.service

import android.app.*
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import androidx.core.app.NotificationCompat
import com.dkbranch.R
import com.dkbranch.socket.OrderSocketManager
import com.dkbranch.socket.data.AppDatabase
import com.dkbranch.socket.data.EncryptedSharedPreferencesManager
import com.dkbranch.socket.data.OrderEntity
import kotlinx.coroutines.*
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class OrderSocketService : Service() {
    private lateinit var socketManager: OrderSocketManager
    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private lateinit var database: AppDatabase
    private var isServiceRunning = false
    private var connectionMonitorJob: Job? = null
    private var fallbackFetchJob: Job? = null
    private var currentServiceStatus: String = "Initializing order service"
    private var orderCount: Int = 0
    private var lastOrderFetchTime: Long = 0
    private var isSocketConnected: Boolean = false
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "OrderSocketService onCreate - Initializing service components.")
        database = AppDatabase.getInstance(this)
        val encryptedPrefsManager = EncryptedSharedPreferencesManager(this)
        
        // Initialize socketManager with database, encryptedPrefsManager, and context
        socketManager = OrderSocketManager(database, encryptedPrefsManager)
        socketManager.setContext(applicationContext)
        
        // Set up event emitter to listen for socket events
        socketManager.setEventEmitter { eventName, params ->
            Log.d(TAG, "SocketManager event received: $eventName, params: ${params?.toHashMap()}")
            serviceScope.launch {
                when (eventName) {
                    "newOrder", "orderUpdate" -> {
                        // Fetch current pending order count from database
                        val currentOrderCount = withContext(Dispatchers.IO) {
                            database.orderDao().getPendingOrderCount()
                        } // Assuming this DAO method exists
                        this@OrderSocketService.orderCount = currentOrderCount
                        currentServiceStatus = if (currentOrderCount > 0) {
                            "$currentOrderCount new orders - Ready for notifications"
                        } else {
                            "Listening for new order notifications"
                        }
                        updateNotification()
                        // Update last fetch time to prevent immediate fallback fetch
                        lastOrderFetchTime = System.currentTimeMillis()
                        // Play notification sound/vibration for new orders
                        if (eventName == "newOrder") {
                            playOrderAlert()
                        }
                    }
                    "socketConnected" -> {
                        // Reset order count on fresh connect if needed, or fetch current
                        val currentOrderCount = withContext(Dispatchers.IO) {
                            database.orderDao().getPendingOrderCount()
                        }
                        this@OrderSocketService.orderCount = currentOrderCount
                        currentServiceStatus = if (currentOrderCount > 0) {
                            "$currentOrderCount new orders - Ready for notifications"
                        } else {
                            "Listening for new order notifications"
                        }
                        isSocketConnected = true
                        updateNotification()
                    }
                    "socketDisconnected" -> {
                        currentServiceStatus = "Reconnecting to order notification service..."
                        isSocketConnected = false
                        // Optionally, maintain current orderCount or set to 0 if connection is lost for long
                        updateNotification()
                    }
                    // Handle other events like "error" if needed
                    "error" -> {
                        val errorMessage = params?.getString("message") ?: "Unknown socket error"
                        Log.e(TAG, "SocketManager reported error: $errorMessage")
                        // Potentially update notification to reflect error state if it's persistent
                        if (errorMessage.contains("Store is closed")) {
                            currentServiceStatus = "Order notifications paused - Store is closed"
                            this@OrderSocketService.orderCount = 0 // Reset count as store is closed
                            updateNotification()
                            // Consider stopping the service or reducing its activity if store is closed
                        }
                    }
                }
            }
        }
        
        // Create notification channel first
        createNotificationChannel()
        
        // Start in foreground immediately with a default notification
        startForeground(NOTIFICATION_ID, createNotification("Listening for new orders - Initializing"))
        
        Log.d(TAG, "Started foreground service with notification: Listening for new orders - Initializing")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Attempt to pull credentials either from intent or from encrypted preferences when
    // the system restarts the service with a null / empty intent (API will deliver null).
    val prefs = EncryptedSharedPreferencesManager(this)

    val branchId = intent?.getStringExtra("branchId") ?: prefs.getBranchId(this)
    val token = intent?.getStringExtra("token") ?: prefs.getToken(this)
    val socketUrl = intent?.getStringExtra("socketUrl")
    val isStoreOpen = intent?.getBooleanExtra("isStoreOpen", prefs.getStoreStatus(this)) ?: prefs.getStoreStatus(this)
    val startedFromBoot = intent?.getBooleanExtra("started_from_boot", false) ?: false

        Log.i(TAG, "OrderSocketService onStartCommand - Intent action: ${intent?.action}, Store Open: $isStoreOpen, Token Present: ${token != null}")

        // Set custom socket URL if provided, otherwise use default
        if (socketUrl != null && socketUrl.isNotEmpty()) {
            socketManager.setSocketServerUrl(socketUrl)
        }

        if (branchId != null && token != null) {
            Log.d(TAG, "Branch ID and Token received. Initializing and connecting socket manager.")
            // Ensure AppDatabase is initialized before socketManager uses it
            AppDatabase.getInstance(applicationContext) 
            
            // Store token for reconnections
            socketManager.setToken(token)
            
            // Connect socket
            Log.i(TAG, "onStartCommand: Store is open, attempting to connect socket for branch $branchId.")
                    socketManager.connect(branchId, token)
            
            // Force update status for notification to ensure correct text is displayed
            currentServiceStatus = "Listening for new order notifications"
            updateNotification()
            Log.d(TAG, "Updated notification to: $currentServiceStatus")
            
            // Start monitoring connection status and updating notification
            startConnectionMonitoring()
            
            // Start fallback order fetch mechanism
            startFallbackOrderFetching(branchId, token)
            
            isServiceRunning = true
        } else {
            Log.w(TAG, "Branch ID or Token is null. Service will not connect. Stopping self.")
            stopSelf() // Stop if no credentials
            return START_NOT_STICKY
        }

        // If the service gets killed, restart it
        return START_STICKY
    }
    
    private fun startConnectionMonitoring() {
        // Cancel existing job if any
        connectionMonitorJob?.cancel()
        
        // Start a new monitoring job
        connectionMonitorJob = serviceScope.launch {
            while (isActive) {
                try {
                    // Check connection status every 15 seconds
                    val isConnected = socketManager.isConnected()
                    isSocketConnected = isConnected
                    
                    if (isConnected) {
                        if (currentServiceStatus != "Listening for new order notifications") {
                            currentServiceStatus = "Listening for new order notifications"
                            updateNotification()
                            Log.d(TAG, "Socket connected, updated notification: $currentServiceStatus")
                        }
                    } else {
                        if (currentServiceStatus != "Reconnecting to order notification service...") {
                            currentServiceStatus = "Reconnecting to order notification service..."
                            updateNotification()
                            Log.d(TAG, "ConnectionMonitor: Socket is disconnected, reconnecting...")
                        }
                    }
                    delay(15000) // 15 seconds
                } catch (e: Exception) {
                    Log.e(TAG, "Error in connection monitoring: ${e.message}")
                    delay(30000) // Longer delay on error
                }
            }
        }
    }
    
    /**
     * Starts fallback order fetching mechanism that runs every 60 seconds
     * This serves as a backup when the socket connection fails or is unstable
     */
    private fun startFallbackOrderFetching(branchId: String, token: String) {
        fallbackFetchJob?.cancel()
        fallbackFetchJob = serviceScope.launch {
            while (isActive) {
                try {
                    // Wait for 60 seconds between checks
                    delay(60 * 1000) // 60 seconds
                    
                    // Only perform fallback fetch if socket is disconnected or if it's been more than 2 minutes since last update
                    val timeSinceLastFetch = System.currentTimeMillis() - lastOrderFetchTime
                    val needsFallbackFetch = !isSocketConnected || timeSinceLastFetch > 2 * 60 * 1000
                    
                    if (needsFallbackFetch && isNetworkAvailable()) {
                        Log.d(TAG, "[Fallback] Performing fallback order fetch")
                        
                        // Get current order count before fetch
                        val currentOrderCount = withContext(Dispatchers.IO) {
                            database.orderDao().getPendingOrderCount()
                        }
                        
                        // Perform API call to fetch orders
                        val newOrders = fetchOrdersDirectly(branchId, token)
                        
                        if (newOrders.isNotEmpty()) {
                            // Store orders in database
                            withContext(Dispatchers.IO) {
                                for (order in newOrders) {
                                    database.orderDao().insert(order)
                                }
                            }
                            
                            // Get updated order count
                            val updatedOrderCount = withContext(Dispatchers.IO) {
                                database.orderDao().getPendingOrderCount()
                            }
                            
                            // Update lastFetchTime to prevent duplicate fetches
                            lastOrderFetchTime = System.currentTimeMillis()
                            
                            // If we found new orders, update notification and play alert
                            if (updatedOrderCount > currentOrderCount) {
                                Log.d(TAG, "[Fallback] New orders detected: ${updatedOrderCount - currentOrderCount}")
                                orderCount = updatedOrderCount
                                currentServiceStatus = "$updatedOrderCount new orders - Ready for notifications"
                                updateNotification()
                                playOrderAlert()
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "[Fallback] Error in fallback order fetching: ${e.message}")
                }
            }
        }
    }
    
    /**
     * Directly fetch orders from the API instead of relying on socket
     */
    private suspend fun fetchOrdersDirectly(branchId: String, token: String): List<OrderEntity> {
        return withContext(Dispatchers.IO) {
            try {
                // Get API base URL from the socket manager that was configured from React Native
                val apiBaseUrl = socketManager.getApiBaseUrl()
                // Construct the URL for fetching orders - ensure we use the same format as in React Native
                // The React Native code uses '/orders/' with trailing slash
                val url = "$apiBaseUrl/orders?branchId=$branchId"
                
                val request = Request.Builder()
                    .url(url)
                    .header("Authorization", "Bearer $token")
                    .get()
                    .build()
                
                Log.d(TAG, "[Fallback] Fetching orders from: $url")
                
                httpClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        Log.e(TAG, "[Fallback] Failed to fetch orders: ${response.code}")
                        return@withContext emptyList<OrderEntity>()
                    }
                    
                    val responseBody = response.body?.string()
                    if (responseBody.isNullOrEmpty()) {
                        Log.e(TAG, "[Fallback] Empty response body")
                        return@withContext emptyList<OrderEntity>()
                    }
                    
                    // Parse JSON response
                    val ordersJson = JSONArray(responseBody)
                    val orderEntities = mutableListOf<OrderEntity>()
                    
                    for (i in 0 until ordersJson.length()) {
                        val orderJson = ordersJson.getJSONObject(i)
                        
                        // Check if order already exists in database
                        val orderId = orderJson.getString("_id")
                        val existingOrder = database.orderDao().getOrderById(orderId)
                        
                        if (existingOrder == null) {
                            // This is a new order
                            val orderEntity = OrderEntity(
                                orderId = orderId,
                                branchId = branchId,
                                orderData = orderJson.toString(),
                                status = orderJson.optString("status", "pending"),
                                createdAt = System.currentTimeMillis(),
                                updatedAt = System.currentTimeMillis()
                            )
                            orderEntities.add(orderEntity)
                        }
                    }
                    
                    Log.d(TAG, "[Fallback] Found ${orderEntities.size} new orders")
                    return@withContext orderEntities
                }
            } catch (e: Exception) {
                Log.e(TAG, "[Fallback] Exception during order fetch: ${e.message}")
                return@withContext emptyList<OrderEntity>()
            }
        }
    }
    
    /**
     * Check if network is available for making API calls
     */
    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork ?: return false
            val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
            
            return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                   capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        } else {
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            @Suppress("DEPRECATION")
            return networkInfo != null && networkInfo.isConnected
        }
    }
    
    /**
     * Play sound and vibration to alert user of new orders
     */
    private fun playOrderAlert() {
        try {
            // Play notification sound
            val notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(applicationContext, notification)
            ringtone.play()
            
            // Vibrate device
            val vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createOneShot(
                        500,
                        VibrationEffect.DEFAULT_AMPLITUDE
                    )
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(500)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing order alert: ${e.message}")
        }
    }
    
    private fun updateNotification() {
        if (isServiceRunning) {
            val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            val notification = createNotification(currentServiceStatus)
            notificationManager.notify(NOTIFICATION_ID, notification)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "OrderSocketService onDestroy - Cleaning up service components.")
        
        // Cancel any running coroutines
        connectionMonitorJob?.cancel()
        fallbackFetchJob?.cancel()
        serviceScope.cancel()
        
        // Disconnect socket
        socketManager.disconnect()
        
        // Remove foreground status
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotification(contentText: String = "Listening for new order notifications"): Notification {
        // Create a PendingIntent to open the app when notification is clicked
        val pendingIntent: PendingIntent = Intent(this, Class.forName("com.dkbranch.MainActivity")).let { notificationIntent ->
            notificationIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            PendingIntent.getActivity(this, 0, notificationIntent, 
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }
        
        // Ensure notification always mentions we're listening for order notifications
        val finalText = if (!contentText.contains("Listening") && !contentText.contains("Reconnecting") && !contentText.contains("paused")) {
            "Listening for new order notifications"
        } else {
            contentText
        }
        
        // Create notification builder
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("dkbranch Order Notifications")
            .setContentText(finalText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_HIGH) // Increased priority for better visibility
            .setContentIntent(pendingIntent)  // Add click action
            .setOngoing(true)                 // Make persistent
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            
        // Add visual indicators based on state
        if (finalText.contains("Reconnecting")) {
            builder.setUsesChronometer(true)  // Show elapsed time during reconnect
        }
        
        if (orderCount > 0) {
            builder.setNumber(orderCount)  // Show order count as badge
        }
        
        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Delete any existing channel first to ensure settings are updated
            try {
                val manager = getSystemService(NotificationManager::class.java)
                manager.deleteNotificationChannel(CHANNEL_ID)
                Log.d(TAG, "Deleted existing notification channel")
            } catch (e: Exception) {
                // Channel might not exist yet, that's fine
            }
            
            // Create a new channel with higher importance
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Order Service Channel",
                NotificationManager.IMPORTANCE_HIGH // High importance to ensure it's visible
            )
            // Configure channel properties
            serviceChannel.description = "Shows when the order notification service is active and receiving real-time updates"
            serviceChannel.setShowBadge(true)         // Show badge on launcher icon
            serviceChannel.enableLights(true)         // Enable lights for more visibility
            serviceChannel.lightColor = android.graphics.Color.BLUE
            serviceChannel.enableVibration(false)
            serviceChannel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
            Log.i(TAG, "Created/Verified notification channel '$CHANNEL_ID' with HIGH importance.")
        }
    }

    companion object {
        private const val TAG = "OrderSocketService"
        private const val NOTIFICATION_ID = 9001 // Use a unique ID to avoid conflicts
        private const val CHANNEL_ID = "OrderNotificationServiceChannel"
        const val ACTION_CONNECT = "com.dkbranch.socket.service.ACTION_CONNECT"
        // Removed EXTRA_BRANCH_ID and EXTRA_TOKEN as we use direct strings now
    }
}