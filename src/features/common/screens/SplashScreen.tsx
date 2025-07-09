import React, {useEffect} from 'react';
import {View, Image, StyleSheet, Platform, StatusBar} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {storage} from '../../../utils/storage'; // MMKV
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  useEffect(() => {
    const checkStatus = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay

      // Request location permission
      try {
        // Check if permission status is already stored
        const storedPermission = storage.getString('locationPermission');
        if (storedPermission === 'granted') {
          // Skip request if already granted
          console.log('Location permission already granted');
        } else {
          // Request "when in use" location permission
          const permissionType =
            Platform.OS === 'ios'
              ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
              : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

          const result = await request(permissionType);

          // Store permission status in MMKV
          switch (result) {
            case RESULTS.GRANTED:
              storage.set('locationPermission', 'granted');
              console.log('Location permission granted');
              break;
            case RESULTS.DENIED:
              storage.set('locationPermission', 'denied');
              console.log('Location permission denied');
              break;
            case RESULTS.BLOCKED:
              storage.set('locationPermission', 'blocked');
              console.log('Location permission blocked');
              break;
            default:
              console.log('Unknown permission result:', result);
          }
        }
      } catch (error) {
        console.error('Location permission error:', error);
        // Proceed without storing status to avoid issues
      }

      // Existing token and status checks
      const token = storage.getString('accessToken'); // Check login token
      const isApproved = storage.getBoolean('isApproved') || false;
      const isRegistered = storage.getBoolean('isRegistered') || false;
      const branchId = storage.getString('branchId');
      const userId = storage.getString('userId');

      console.log('SplashScreen checking auth state:', {
        token: !!token,
        isApproved,
        isRegistered,
        branchId,
        userId,
      });

      // First check if user is registered but not approved - highest priority
      if (isRegistered && branchId && !isApproved) {
        console.log(
          'User is registered but not approved - going to StatusScreen',
        );
        navigation.replace('StatusScreen', {branchId});
      }
      // If approved and token exists - go directly to HomeScreen
      // The HomeScreen now has its own prepare.json animation overlay
      else if (token && (isApproved || userId)) {
        console.log('User is logged in with token - going to HomeScreen');
        navigation.replace('HomeScreen');
      }
      // If only approved but no token - try to login
      else if (isApproved && !token) {
        console.log('User is approved but no token - going to Authentication');
        navigation.replace('Authentication');
      }
      // Otherwise go to EntryScreen for registration
      else {
        console.log('User is new - going to EntryScreen');
        navigation.replace('EntryScreen');
      }
    };

    checkStatus().catch(err => {
      console.error('Status check error:', err);
      navigation.replace('EntryScreen');
    });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor="#340e5c"
        barStyle="light-content"
        translucent={false}
      />
      <Image
        source={require('../../../assets/images/Logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#340e5c',
  },
  logo: {
    width: 200,
    height: 200,
  },
});

export default SplashScreen;
