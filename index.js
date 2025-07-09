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
  console.log('FCM background message:', remoteMessage);
  try {
    // Display a local notification so the user still sees an alert
    FCMService.displayLocalNotification(remoteMessage);
    // TODO: you can add logic here to cache a flag or refresh order list
  } catch (err) {
    console.error('Error in background handler:', err);
  }
});

AppRegistry.registerComponent(appName, () => App);
