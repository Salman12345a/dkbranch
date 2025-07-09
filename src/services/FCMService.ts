import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';
import axios from 'axios';
import { config } from '../config';

class FCMService {
  // Initialize FCM
  async init() {
    // Configure push notification channel for Android
    if (Platform.OS === 'android') {
      this.createNotificationChannel();
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

    // Set up background/quit state handlers
    this.setBackgroundMessageHandler();
  }

  // Create notification channel for Android
  createNotificationChannel() {
    PushNotification.createChannel(
      {
        channelId: 'orders', // Must match the channelId sent from backend
        channelName: 'Order Notifications',
        channelDescription: 'Notifications for new orders and updates',
        playSound: true,
        soundName: 'default',
        importance: 4, // High importance
        vibrate: true,
      },
      (created: boolean) => console.log(`Channel 'orders' created: ${created}`)
    );
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

  // Get FCM token and register with backend
  async getFCMToken() {
    try {
      const fcmToken = await messaging().getToken();
      console.log('FCM Token:', fcmToken);

      // Store token locally
      await AsyncStorage.setItem('fcmToken', fcmToken);

      // Register token with backend
      await this.registerTokenWithBackend(fcmToken);

      return fcmToken;
    } catch (error) {
      console.error('FCM token retrieval error:', error);
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
      const userId = await AsyncStorage.getItem('branchId');
      const authToken = await AsyncStorage.getItem('accessToken');
      
      if (!userId || !authToken) {
        console.log('User not logged in, skipping FCM token registration');
        return;
      }

      await axios.post(
        `${config.BASE_URL}/api/device-tokens/register`,
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

  // Handle foreground messages
  onMessage() {
    messaging().onMessage(async (remoteMessage) => {
      console.log('FCM Message received in foreground:', remoteMessage);
      
      // Display local notification
      this.displayLocalNotification(remoteMessage);
    });
  }

  // Set up background message handler
  setBackgroundMessageHandler() {
    // This handler will be called when app is in background or terminated
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('FCM Message handled in the background:', remoteMessage);
      
      // We don't need to create a local notification here as FCM will show it automatically
      // However, we might want to handle data from the message
      return Promise.resolve();
    });
  }

  // Display local notification (for foreground messages)
  displayLocalNotification(remoteMessage: any) {
    const { notification, data } = remoteMessage;
    
    console.log('Attempting to display local notification:', { notification, data });
    
    if (!notification) {
      console.warn('No notification object found in the message');
      return;
    }

    try {
      // Create a notification configuration object
      const notificationConfig = {
        channelId: 'orders',
        title: notification.title || 'New Notification',
        message: notification.body || 'You have a new notification',
        playSound: true,
        soundName: 'default',
        importance: 'high',
        vibrate: true,
        data: data || {},
        // Add these properties to increase visibility
        visibility: 'public',
        priority: 'high',
        smallIcon: 'ic_notification', // Make sure this icon exists in your Android resources
        largeIcon: '',
        // Ensure notification shows even when app is in foreground
        ignoreInForeground: false,
      };
      
      console.log('Sending local notification with config:', notificationConfig);
      PushNotification.localNotification(notificationConfig);
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
