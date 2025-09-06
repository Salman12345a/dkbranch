import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { config } from '../config';
import { storage } from '../utils/storage';
import PushNotification from 'react-native-push-notification';

class FCMService {
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

    // Get FCM token
    await this.getFCMToken();

    // Listen for token refresh
    this.onTokenRefresh();

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
        soundName: 'order_notification.mp3', // Custom ringtone for orders
        importance: 4, // High importance
        vibrate: true,
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
      
      console.log('FCM Registration - userId:', userId, 'hasToken:', !!authToken);
      
      if (!userId || !authToken) {
        console.log('User not logged in, skipping FCM token registration');
        return;
      }

      await axios.post(
        `${config.BASE_URL}/device-tokens/register`,
        {
          token,
          platform: Platform.OS,
        },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      
      console.log('FCM token registered with backend successfully');
    } catch (error) {
      console.error('Failed to register FCM token with backend:', error);
    }
  }

  // Register FCM token after authentication is confirmed
  async registerTokenAfterAuth() {
    try {
      const fcmToken = await AsyncStorage.getItem('fcmToken');
      if (fcmToken) {
        console.log('Registering existing FCM token after authentication');
        await this.registerTokenWithBackend(fcmToken);
      } else {
        console.log('Getting new FCM token after authentication');
        await this.getFCMTokenAndRegister();
      }
    } catch (error) {
      console.error('Failed to register FCM token after auth:', error);
    }
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
      
      // Display local notification
      this.displayLocalNotification(remoteMessage);
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
      // Create a notification configuration object for background
      const notificationConfig = {
        channelId: 'orders',
        title: title,
        message: body,
        playSound: true,
        soundName: 'order_notification.mp3', // Custom ringtone
        importance: 'high',
        vibrate: true,
        data: data || {},
        visibility: 'public',
        priority: 'high',
        smallIcon: 'ic_notification', // Custom notification icon
       
        // Force notification to show
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
      };
      
      console.log('=== SENDING BACKGROUND NOTIFICATION ===');
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
        soundName: 'order_notification.mp3', // Custom ringtone
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
      const authToken = await AsyncStorage.getItem('accessToken');
      
      if (fcmToken && authToken) {
        await axios.post(
          `${config.BASE_URL}/api/device-tokens/unregister`,
          { token: fcmToken },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        
        console.log('FCM token unregistered successfully');
      }
      
      // Clear token from AsyncStorage
      await AsyncStorage.removeItem('fcmToken');
    } catch (error) {
      console.error('Failed to unregister FCM token:', error);
    }
  }
}

export default new FCMService();
