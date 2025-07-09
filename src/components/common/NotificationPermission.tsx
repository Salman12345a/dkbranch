import React, { useEffect } from 'react';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';

const NotificationPermission: React.FC = () => {
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  const checkNotificationPermission = async () => {
    try {
      // iOS uses messaging().requestPermission()
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled = 
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        
        if (!enabled) {
          Alert.alert(
            'Enable Notifications',
            'Please enable notifications in your device settings to receive order updates.',
            [{ text: 'OK' }]
          );
        }
      } 
      // Android requires separate permission checks for newer Android versions (13+)
      else if (Platform.OS === 'android') {
        try {
          // For Android 13+ (API level 33 and above)
          if (Platform.Version >= 33) {
            // Check if the required permission exists in PermissionsAndroid
            if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
                {
                  title: 'Notification Permission',
                  message: 'We need permission to send you order notifications',
                  buttonNeutral: 'Ask Me Later',
                  buttonNegative: 'Cancel',
                  buttonPositive: 'OK',
                }
              );
              
              if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert(
                  'Enable Notifications',
                  'Please enable notifications in your device settings to receive order updates.',
                  [{ text: 'OK' }]
                );
              }
            }
          }
          // For older Android versions, no explicit permission is needed
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      }
    } catch (error) {
      console.error('Error checking notification permission:', error);
    }
  };

  return null; // This component doesn't render anything
};

export default NotificationPermission;
