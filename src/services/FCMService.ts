import messaging from '@react-native-firebase/messaging';
import { Platform, AppState, AppStateStatus } from 'react-native';
import axios from 'axios';
import { config } from '../config';
import { storage } from '../utils/storage';
import PushNotification from 'react-native-push-notification';

// FCM token keys — all stored in MMKV for consistency with the rest of the app
const FCM_KEY_TOKEN = 'fcmToken';
const FCM_KEY_PENDING = 'pendingFCMToken';
const FCM_KEY_REGISTERED_AT = 'fcmTokenRegisteredAt';
const FCM_KEY_LAST_REGISTERED = 'fcm_last_registered';


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
    console.log('[FCM] Creating notification channels for Android...');
    
    // Create multiple channels for different types of notifications
    const channels = [
      {
        channelId: 'orders',
        channelName: 'Order Notifications',
        channelDescription: 'Notifications for new orders and updates',
        playSound: true,
        soundName: 'default', // Use default sound for now to ensure notifications show
        importance: 4, // IMPORTANCE_HIGH (Android 4 = high, 5 might cause issues)
        vibrate: true,
        showBadge: true,
        lights: true,
        lightColor: '#FF6B35',
        visibility: 1, // VISIBILITY_PUBLIC
      },
      {
        channelId: 'order_updates',
        channelName: 'Order Updates',
        channelDescription: 'Notifications for order status changes',
        playSound: true,
        soundName: 'default',
        importance: 4, // High importance
        vibrate: true,
        showBadge: true,
      },
      {
        channelId: 'general',
        channelName: 'General Notifications',
        channelDescription: 'General app notifications',
        playSound: true,
        soundName: 'default',
        importance: 3, // Default importance
        vibrate: true,
        showBadge: true,
      }
    ];

    channels.forEach(channel => {
      console.log(`[FCM] Creating channel: ${channel.channelId} with importance: ${channel.importance}`);
      PushNotification.createChannel(
        channel,
        (created: boolean) => {
          console.log(`[FCM] Channel '${channel.channelId}' created: ${created}`);
          if (!created) {
            console.log(`[FCM] Channel '${channel.channelId}' already exists or failed to create`);
          }
        }
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
      // Store token in MMKV (same storage as auth tokens)
      storage.set(FCM_KEY_TOKEN, fcmToken);
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
      // Store refreshed token in MMKV
      storage.set(FCM_KEY_TOKEN, fcmToken);
      // Register refreshed token with backend
      await this.registerTokenWithBackend(fcmToken);
    });
  }

  // Register token with backend
  async registerTokenWithBackend(token: string) {
    try {
      // Read all credentials from MMKV (single storage source)
      let userId = storage.getString('branchId');
      if (!userId) {
        userId = storage.getString('userId');
      }
      const authToken = storage.getString('accessToken');
      
      console.log('=== FCM TOKEN REGISTRATION ATTEMPT ===');
      console.log('FCM Registration - userId:', userId, 'hasToken:', !!authToken);
      console.log('FCM Registration - token length:', token?.length);
      
      if (!userId || !authToken) {
        console.log('User not logged in, storing FCM token in MMKV for later registration');
        storage.set(FCM_KEY_PENDING, token);
        return false;
      }

      // Clear any pending token since we're about to register
      storage.delete(FCM_KEY_PENDING);

      const requestPayload = {
        token,
        platform: Platform.OS,
        userId,
      };
      
      console.log('FCM Registration - endpoint:', `${config.BASE_URL}/device-tokens/register`);

      const response = await axios.post(
        `${config.BASE_URL}/device-tokens/register`,
        requestPayload,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      
      console.log('=== FCM TOKEN REGISTRATION SUCCESS === status:', response.status);
      // Store registration timestamp in MMKV
      storage.set(FCM_KEY_REGISTERED_AT, Date.now().toString());
      return true;
    } catch (error: any) {
      console.error('=== FCM TOKEN REGISTRATION FAILED ===', {
        message: error?.message,
        status: error?.response?.status,
        code: error?.code,
      });
      // Store pending token for retry on network errors
      if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNABORTED') {
        storage.set(FCM_KEY_PENDING, token);
      }
      return false;
    }
  }

  // Register FCM token after authentication is confirmed
  async registerTokenAfterAuth() {
    try {
      // Check MMKV for pending token first (in case registration failed during init)
      let fcmToken = storage.getString(FCM_KEY_PENDING);
      if (!fcmToken) {
        fcmToken = storage.getString(FCM_KEY_TOKEN) ?? null;
      }
      
      if (fcmToken) {
        console.log('Registering FCM token after authentication, token length:', fcmToken.length);
        const success = await this.registerTokenWithBackend(fcmToken);
        if (!success) {
          console.log('FCM token registration failed, will retry later');
        }
      } else {
        console.log('No FCM token found in MMKV, getting new token after authentication');
        await this.getFCMTokenAndRegister();
      }
    } catch (error) {
      console.error('Failed to register FCM token after auth:', error);
    }
  }

  // Setup app state monitoring to detect overlays
  setupAppStateMonitoring() {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[FCM] App state changed from', this.appState, 'to', nextAppState);
      
      // More robust app visibility detection
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        this.isAppVisible = false;
        console.log('[FCM] App not visible - background notifications enabled');
      } else if (nextAppState === 'active') {
        // Add a small delay to ensure app is truly active
        setTimeout(() => {
          this.isAppVisible = true;
          console.log('[FCM] App is active and visible - foreground notifications enabled');
          
          // Clear all notifications when app becomes active
          this.clearAllNotifications();
        }, 100);
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
      // Simplified background notification config for better compatibility
      const notificationConfig = {
        channelId: 'orders',
        title: title,
        message: body,
        playSound: true,
        soundName: 'default', // Use default sound for reliability
        importance: 'high', // High importance (avoid 'max' which might cause issues)
        priority: 'high',
        vibrate: true,
        data: data || {},
        visibility: 'public',
        smallIcon: 'ic_notification',
        // Add unique ID to prevent overwriting
        id: Date.now(),
        // Essential properties for background display
        ongoing: false,
        autoCancel: true,
        color: '#FF6B35',
        showWhen: true,
        when: Date.now(),
        userInteraction: false,
        // Additional properties to ensure display
        tag: `bg_order_${Date.now()}`, // Unique tag for background
        group: 'orders',
        allowWhileIdle: true,
        // Wake screen for important notifications
        wakeScreen: true,
        // Ticker text for accessibility
        ticker: title,
        subText: 'DoKirana Order',
      };
      
      console.log('=== SENDING BACKGROUND NOTIFICATION ===');
      console.log('Config:', JSON.stringify(notificationConfig, null, 2));
      
      // Use setTimeout to ensure notification is processed
      setTimeout(() => {
        PushNotification.localNotification(notificationConfig);
        console.log('[FCM] Background notification sent successfully');
      }, 100);
      
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
      // Create a notification configuration object with simplified settings for better compatibility
      const notificationConfig = {
        channelId: 'orders',
        title: title,
        message: body,
        playSound: true,
        soundName: 'default', // Use default sound for reliability
        importance: 'high',
        priority: 'high',
        vibrate: true,
        data: data || {},
        visibility: 'public',
        smallIcon: 'ic_notification',
        // Add unique ID to prevent overwriting
        id: Date.now(),
        // Essential Android properties for display
        ongoing: false,
        autoCancel: true,
        color: '#FF6B35',
        showWhen: true,
        when: Date.now(),
        // Force notification to show
        ignoreInForeground: false,
        userInteraction: false,
        // Additional properties to ensure display
        tag: `order_${Date.now()}`, // Unique tag
        group: 'orders', // Group notifications
        allowWhileIdle: true, // Allow while device is idle
      };
      
      console.log('=== SENDING LOCAL NOTIFICATION ===');
      console.log('Config:', JSON.stringify(notificationConfig, null, 2));
      
      // Use setTimeout to ensure notification is processed
      setTimeout(() => {
        PushNotification.localNotification(notificationConfig);
        console.log('[FCM] Local notification sent successfully');
      }, 100);
      
    } catch (error) {
      console.error('Error displaying local notification:', error);
    }
  }

  // Unregister token when logging out
  async unregisterToken() {
    try {
      const fcmToken = storage.getString(FCM_KEY_TOKEN);
      const authToken = storage.getString('accessToken');
      
      if (fcmToken && authToken) {
        await axios.post(
          `${config.BASE_URL}/device-tokens/unregister`,
          { token: fcmToken },
          {
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 5000,
          }
        );
        console.log('FCM token unregistered successfully');
      }
      
      // Clear all FCM related data from MMKV
      storage.delete(FCM_KEY_TOKEN);
      storage.delete(FCM_KEY_PENDING);
      storage.delete(FCM_KEY_REGISTERED_AT);
      storage.delete(FCM_KEY_LAST_REGISTERED);
    } catch (error) {
      console.error('Failed to unregister FCM token:', error);
      // Still clear local tokens even if unregistration fails
      storage.delete(FCM_KEY_TOKEN);
      storage.delete(FCM_KEY_PENDING);
      storage.delete(FCM_KEY_REGISTERED_AT);
      storage.delete(FCM_KEY_LAST_REGISTERED);
    }
  }

  // Retry pending FCM token registration
  async retryPendingTokenRegistration() {
    try {
      const pendingToken = storage.getString(FCM_KEY_PENDING);
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
      const currentTime = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const lastRegistered = storage.getString(FCM_KEY_LAST_REGISTERED);
      
      if (!lastRegistered || (currentTime - parseInt(lastRegistered, 10)) > oneDayMs) {
        console.log('FCM token needs re-registration');
        await this.registerTokenAfterAuth();
        // Update last-registered timestamp
        storage.set(FCM_KEY_LAST_REGISTERED, currentTime.toString());
      }
    } catch (error) {
      console.error('Error checking FCM token registration status:', error);
    }
  }

  // Clear all notifications from notification bar
  clearAllNotifications() {
    console.log('[FCM] Clearing all notifications from notification bar...');
    try {
      PushNotification.cancelAllLocalNotifications();
      console.log('[FCM] All notifications cleared successfully');
    } catch (error) {
      console.error('[FCM] Error clearing notifications:', error);
    }
  }

  // Clear notifications by tag/group
  clearNotificationsByTag(tag: string) {
    console.log(`[FCM] Clearing notifications with tag: ${tag}`);
    try {
      PushNotification.cancelLocalNotifications({ tag });
      console.log(`[FCM] Notifications with tag ${tag} cleared`);
    } catch (error) {
      console.error(`[FCM] Error clearing notifications with tag ${tag}:`, error);
    }
  }

  // Test notification display (for debugging)
  testNotification() {
    console.log('[FCM] Testing notification display...');
    
    const testConfig = {
      channelId: 'orders',
      title: 'Test Notification',
      message: 'This is a test notification to verify display functionality',
      playSound: true,
      soundName: 'default',
      importance: 'high',
      priority: 'high',
      vibrate: true,
      visibility: 'public',
      smallIcon: 'ic_notification',
      id: Date.now(),
      ongoing: false,
      autoCancel: true,
      color: '#FF6B35',
      showWhen: true,
      when: Date.now(),
      tag: `test_${Date.now()}`,
      group: 'orders',
      allowWhileIdle: true,
    };
    
    console.log('[FCM] Test notification config:', JSON.stringify(testConfig, null, 2));
    
    setTimeout(() => {
      PushNotification.localNotification(testConfig);
      console.log('[FCM] Test notification sent');
    }, 100);
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
