/**
 * @format
 */

import {AppRegistry, Platform} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import FCMService from './src/services/FCMService';
import App from './App';
import {name as appName} from './app.json';

// Ensure notification channel exists even before any screen mounts
if (Platform.OS === 'android') {
  FCMService.createNotificationChannel();
}

// Handle background & quit-state messages (data-only pushes)
// Must be registered before registerComponent
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('=== FCM BACKGROUND MESSAGE RECEIVED ===');
  console.log('Message ID:', remoteMessage.messageId);
  console.log('Has notification:', !!remoteMessage.notification);
  console.log('Has data:', !!remoteMessage.data);
  
  try {
    // Immediate background notification display for efficiency
    FCMService.displayBackgroundNotification(remoteMessage);
    console.log('[FCM] Background notification processed successfully');
    
    // Return promise to ensure proper handling
    return Promise.resolve();
  } catch (err) {
    console.error('[FCM] Error in background handler:', err);
    return Promise.reject(err);
  }
});

// Add notification opened handler
messaging().onNotificationOpenedApp(remoteMessage => {
  console.log('Notification caused app to open from background state:', remoteMessage);
});

// Check whether an initial notification is available
messaging()
  .getInitialNotification()
  .then(remoteMessage => {
    if (remoteMessage) {
      console.log('Notification caused app to open from quit state:', remoteMessage);
    }
  });

AppRegistry.registerComponent(appName, () => App);
