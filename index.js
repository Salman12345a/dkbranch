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
  console.log('Message:', JSON.stringify(remoteMessage, null, 2));
  console.log('Has notification:', !!remoteMessage.notification);
  console.log('Has data:', !!remoteMessage.data);
  console.log('Message ID:', remoteMessage.messageId);
  console.log('From:', remoteMessage.from);
  
  try {
    // Use the background notification method for proper handling
    FCMService.displayBackgroundNotification(remoteMessage);
    console.log('Background notification sent successfully');
  } catch (err) {
    console.error('Error in background handler:', err);
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
