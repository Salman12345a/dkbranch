import messaging from '@react-native-firebase/messaging';
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { config } from '../config';
import { storage } from '../utils/storage';
import PushNotification from 'react-native-push-notification';

class FCMService {
  private appState: AppStateStatus = 'active';
  private isAppVisible: boolean = true;
  private appStateSubscription: any = null;
  // Initialize FCM
  async init() {
    // Configure push notification channel for Android - do this first
    if (Platform.OS === 'android') {
      this.createNotificationChannel();
      // Also configure PushNotification settings
      this.configurePushNotification();
    }

    // Request permission for iOS (Android doesn't need this)
    if (Platform.OS === 'ios') {
      await this.requestPermission();
    }

    // Get FCM token and try to register it (will store for later if not authenticated)
    await this.getFCMTokenAndRegister();

    // Listen for token refresh
    this.onTokenRefresh();

    // Set up app state monitoring
    this.setupAppStateMonitoring();

    // Set up foreground message handler
    this.onMessage();

    // Note: Background message handler is set up in index.js
  }

  // Create notification channel for Android
  createNotificationChannel() {
    // Create multiple channels for different types of notifications
    const channels = [
      {
        channelId: 'orders',
        channelName: 'Order Notifications',
        channelDescription: 'Notifications for new orders and updates',
        playSound: true,
        soundName: 'order_notification', // Custom ringtone for orders (no extension)
        importance: 5, // Maximum importance (IMPORTANCE_HIGH = 4, IMPORTANCE_MAX = 5)
        vibrate: true,
        showBadge: true,
        bypassDnd: true, // Bypass Do Not Disturb
        lights: true,
        lightColor: '#FF6B35',
      },
      {
        channelId: 'order_updates',
        channelName: 'Order Updates',
        channelDescription: 'Notifications for order status changes',
        playSound: true,
        soundName: 'default',
        importance: 3, // Default importance
        vibrate: true,
      },
      {
        channelId: 'general',
        channelName: 'General Notifications',
        channelDescription: 'General app notifications',
        playSound: true,
        soundName: 'default',
        importance: 2, // Low importance
        vibrate: false,
      }
    ];

    channels.forEach(channel => {
      PushNotification.createChannel(
        channel,
        (created: boolean) => console.log(`Channel '${channel.channelId}' created: ${created}`)
      );
    });
  }

  // Configure PushNotification settings
  configurePushNotification() {
    PushNotification.configure({
      // Called when Token is generated (iOS and Android)
      onRegister: function (token) {
        console.log('PushNotification TOKEN:', token);
      },

      // Called when a remote is received or opened/clicked
      onNotification: function (notification) {
        console.log('PushNotification NOTIFICATION:', notification);
        
        // Process the notification tap
        if (notification.userInteraction) {
          // User tapped on notification
          console.log('User tapped notification:', notification);
        }
        
        // Required on iOS only
        notification.finish && notification.finish();
      },
    });
  }

  // Request Android notification permission for Android 13+
  async requestAndroidNotificationPermission() {
    try {
      // Import PermissionsAndroid dynamically to avoid issues on iOS
      const { PermissionsAndroid } = require('react-native');
      
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting Android notification permission:', error);
      return false;
    }
  }
  
  // Request permission (for iOS and Android 13+)
  async requestPermission() {
    try {
      // For Android 13+ (API level 33+), request notification permission
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const granted = await this.requestAndroidNotificationPermission();
        if (!granted) {
          console.log('Android notification permission denied');
          return false;
        }
      }
      
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('FCM Authorization status:', authStatus);
        return true;
      }
      console.log('FCM permission denied');
      return false;
    } catch (error) {
      console.error('FCM permission request error:', error);
      return false;
    }
  }

  // Get FCM token without auto-registering with backend
  async getFCMToken() {
    try {
      const fcmToken = await messaging().getToken();
      console.log('FCM Token:', fcmToken);

      // Store token locally
      await AsyncStorage.setItem('fcmToken', fcmToken);

      return fcmToken;
    } catch (error) {
      console.error('FCM token retrieval error:', error);
      return null;
    }
  }

  // Get FCM token and register with backend (legacy method)
  async getFCMTokenAndRegister() {
    try {
      const fcmToken = await this.getFCMToken();
      if (fcmToken) {
        await this.registerTokenWithBackend(fcmToken);
      }
      return fcmToken;
    } catch (error) {
      console.error('FCM token retrieval and registration error:', error);
      return null;
    }
  }

  // Handle token refresh
  onTokenRefresh() {
    messaging().onTokenRefresh(async (fcmToken) => {
      console.log('FCM Token refreshed:', fcmToken);
      
      // Store refreshed token
      await AsyncStorage.setItem('fcmToken', fcmToken);
      
      // Register refreshed token with backend
      await this.registerTokenWithBackend(fcmToken);
    });
  }

  // Register token with backend
  async registerTokenWithBackend(token: string) {
    try {
      // Use MMKV storage to match the app's storage system
      let userId = storage.getString('branchId');
      if (!userId) {
        userId = storage.getString('userId');
      }
      const authToken = storage.getString('accessToken');
      
      console.log('=== FCM TOKEN REGISTRATION ATTEMPT ===');
      console.log('FCM Registration - userId:', userId, 'hasToken:', !!authToken);
      console.log('FCM Registration - token length:', token?.length);
      console.log('FCM Registration - endpoint:', `${config.BASE_URL}/device-tokens/register`);
      
      if (!userId || !authToken) {
        console.log('User not logged in, storing token for later registration');
        // Store token for later registration when user logs in
        await AsyncStorage.setItem('pendingFCMToken', token);
        return false;
      }

      // Clear any pending token since we're about to register
      await AsyncStorage.removeItem('pendingFCMToken');

      const requestPayload = {
        token,
        platform: Platform.OS,
        userId: userId, // Include userId in payload for better backend tracking
      };
      
      console.log('FCM Registration - request payload:', JSON.stringify(requestPayload, null, 2));

      const response = await axios.post(
        `${config.BASE_URL}/device-tokens/register`,
        requestPayload,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );
      
      console.log('=== FCM TOKEN REGISTRATION SUCCESS ===');
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      
      // Store successful registration timestamp
      await AsyncStorage.setItem('fcmTokenRegisteredAt', Date.now().toString());
      return true;
    } catch (error: any) {
      console.error('=== FCM TOKEN REGISTRATION FAILED ===');
      console.error('Error details:', {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        code: error?.code,
        config: {
          url: error?.config?.url,
          method: error?.config?.method,
          headers: error?.config?.headers,
        }
      });
      
      // If it's a network error, store token for retry
      if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNABORTED') {
        console.log('Network error detected, storing token for retry');
        await AsyncStorage.setItem('pendingFCMToken', token);
      }
      return false;
    }
  }

  // Register FCM token after authentication is confirmed
  async registerTokenAfterAuth() {
    try {
      // Check for pending token first (in case registration failed during init)
      let fcmToken = await AsyncStorage.getItem('pendingFCMToken');
      if (!fcmToken) {
        fcmToken = await AsyncStorage.getItem('fcmToken');
      }
      
      if (fcmToken) {
        console.log('Registering FCM token after authentication, token length:', fcmToken.length);
        const success = await this.registerTokenWithBackend(fcmToken);
        if (!success) {
          console.log('FCM token registration failed, will retry later');
        }
      } else {
        console.log('No FCM token found, getting new token after authentication');
        await this.getFCMTokenAndRegister();
      }
    } catch (error) {
      console.error('Failed to register FCM token after auth:', error);
    }
  }

  // Setup app state monitoring to detect overlays
  setupAppStateMonitoring() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('App state changed from', this.appState, 'to', nextAppState);
      
      // Detect if app is covered by overlay (active but not visible)
      if (this.appState === 'active' && nextAppState === 'background') {
        this.isAppVisible = false;
        console.log('App moved to background - notifications should use background handler');
      } else if (nextAppState === 'active') {
        this.isAppVisible = true;
        console.log('App is now active and visible');
      }
      
      this.appState = nextAppState;
    });
  }

  // Handle foreground messages
  onMessage() {
    messaging().onMessage(async (remoteMessage) => {
      console.log('=== FCM FOREGROUND MESSAGE RECEIVED ===');
      console.log('Message:', JSON.stringify(remoteMessage, null, 2));
      console.log('Has notification:', !!remoteMessage.notification);
      console.log('Has data:', !!remoteMessage.data);
      console.log('Message ID:', remoteMessage.messageId);
      console.log('From:', remoteMessage.from);
      console.log('App state:', this.appState, 'Visible:', this.isAppVisible);
      
      // Always display notification, but use appropriate method based on app visibility
      if (this.isAppVisible && this.appState === 'active') {
        this.displayLocalNotification(remoteMessage);
      } else {
        // App might be covered by overlay, use background notification method
        console.log('App not fully visible, using background notification method');
        this.displayBackgroundNotification(remoteMessage);
      }
    });
  }


  // Display background notification (for background messages)
  displayBackgroundNotification(remoteMessage: any) {
    const { notification, data } = remoteMessage;
    
    console.log('=== ATTEMPTING TO DISPLAY BACKGROUND NOTIFICATION ===');
    console.log('Notification object:', notification);
    console.log('Data object:', data);
    
    // Handle both notification and data-only messages
    const title = notification?.title || data?.title || 'New Order';
    const body = notification?.body || data?.body || 'You have a new order notification';
    
    console.log('Using title:', title);
    console.log('Using body:', body);

    try {
      // Create a notification configuration object for background with maximum priority
      const notificationConfig = {
        channelId: 'orders',
        title: title,
        message: body,
        playSound: true,
        soundName: 'order_notification', // Custom ringtone (no extension)
        importance: 'max', // Maximum importance to bypass overlays
        vibrate: true,
        data: data || {},
        visibility: 'public',
        priority: 'max', // Maximum priority
        smallIcon: 'ic_notification', // Custom notification icon
       
        // Force notification to show even with overlays
        ongoing: false,
        autoCancel: true,
        // Add unique ID to prevent overwriting
        id: Date.now(),
        // Additional properties for background
        userInteraction: false,
        invokeApp: true,
        // Custom notification styling
        color: '#FF6B35', // Orange color for notification
        showWhen: true,
        when: Date.now(),
        
        // Android-specific properties to bypass overlays
        fullScreenIntent: true, // Show as heads-up notification
        category: 'call', // High priority category
        actions: [], // Clear any conflicting actions
        
        // Force display properties
        alertAction: 'view',
        hasAction: true,
        
        // Bypass Do Not Disturb
        bypassDnd: true,
        
        // Additional Android properties
        ticker: title, // Ticker text for accessibility
        subText: 'DoKirana Order', // Subtitle
        bigText: body, // Expanded text
        
        // Ensure it shows over other apps
        showLights: true,
        ledColor: '#FF6B35',
        
        // Wake screen properties
        wakeScreen: true,
        
        // Group properties to prevent bundling
        group: `order_${Date.now()}`,
        groupSummary: false,
      };
      
      console.log('=== SENDING BACKGROUND NOTIFICATION WITH MAX PRIORITY ===');
      console.log('Config:', JSON.stringify(notificationConfig, null, 2));
      PushNotification.localNotification(notificationConfig);
      console.log('Background notification sent successfully');
    } catch (error) {
      console.error('Error displaying background notification:', error);
    }
  }

  // Display local notification (for foreground messages)
  displayLocalNotification(remoteMessage: any) {
    const { notification, data } = remoteMessage;
    
    console.log('=== ATTEMPTING TO DISPLAY LOCAL NOTIFICATION ===');
    console.log('Notification object:', notification);
    console.log('Data object:', data);
    
    // Handle both notification and data-only messages
    const title = notification?.title || data?.title || 'New Order';
    const body = notification?.body || data?.body || 'You have a new order notification';
    
    console.log('Using title:', title);
    console.log('Using body:', body);

    try {
      // Create a notification configuration object
      const notificationConfig = {
        channelId: 'orders',
        title: title,
        message: body,
        playSound: true,
        soundName: 'order_notification', // Custom ringtone (no extension)
        importance: 'high',
        vibrate: true,
        data: data || {},
        // Add these properties to increase visibility
        visibility: 'public',
        priority: 'high',
        smallIcon: 'ic_notification', // Custom notification icon
        largeIcon: 'https://storage.googleapis.com/dokirana-official/logo.png', // DoKirana logo
        // Ensure notification shows even when app is in foreground
        ignoreInForeground: false,
        // Add unique ID to prevent overwriting
        id: Date.now(),
        // Force show in foreground
        userInteraction: false,
        // Additional Android properties
        ongoing: false,
        autoCancel: true,
        // Custom notification styling
        color: '#FF6B35', // Orange color for notification
        showWhen: true,
        when: Date.now(),
      };
      
      console.log('=== SENDING LOCAL NOTIFICATION ===');
      console.log('Config:', JSON.stringify(notificationConfig, null, 2));
      PushNotification.localNotification(notificationConfig);
      console.log('Local notification sent successfully');
    } catch (error) {
      console.error('Error displaying local notification:', error);
    }
  }

  // Unregister token when logging out
  async unregisterToken() {
    try {
      const fcmToken = await AsyncStorage.getItem('fcmToken');
      const authToken = storage.getString('accessToken'); // Use MMKV storage
      
      if (fcmToken && authToken) {
        await axios.post(
          `${config.BASE_URL}/device-tokens/unregister`, // Match the registration endpoint pattern
          { token: fcmToken },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
            timeout: 5000, // 5 second timeout for logout
          }
        );
        
        console.log('FCM token unregistered successfully');
      }
      
      // Clear all FCM related data from AsyncStorage
      await AsyncStorage.multiRemove(['fcmToken', 'pendingFCMToken', 'fcmTokenRegisteredAt']);
    } catch (error) {
      console.error('Failed to unregister FCM token:', error);
      // Still clear local tokens even if unregistration fails
      await AsyncStorage.multiRemove(['fcmToken', 'pendingFCMToken', 'fcmTokenRegisteredAt']);
    }
  }

  // Retry pending FCM token registration
  async retryPendingTokenRegistration() {
    try {
      const pendingToken = await AsyncStorage.getItem('pendingFCMToken');
      if (pendingToken) {
        console.log('Retrying pending FCM token registration');
        const success = await this.registerTokenWithBackend(pendingToken);
        if (success) {
          console.log('Pending FCM token registration successful');
        }
        return success;
      }
      return true; // No pending token, consider it successful
    } catch (error) {
      console.error('Failed to retry pending FCM token registration:', error);
      return false;
    }
  }

  // Check if FCM token needs re-registration (call this periodically)
  async checkTokenRegistrationStatus() {
    try {
      const lastRegistered = await AsyncStorage.getItem('fcmTokenRegisteredAt');
      const currentTime = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      // Re-register token if it's been more than 24 hours or never registered
      if (!lastRegistered || (currentTime - parseInt(lastRegistered)) > oneDayMs) {
        console.log('FCM token needs re-registration');
        await this.registerTokenAfterAuth();
      }
    } catch (error) {
      console.error('Error checking FCM token registration status:', error);
    }
  }

  // Cleanup method to remove listeners
  cleanup() {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }
}

export default new FCMService();
