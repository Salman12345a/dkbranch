import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
  Linking,
  AppState,
} from 'react-native';
import {Picker} from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import Geolocation from '@react-native-community/geolocation';
import {storage} from '../../../utils/storage';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import NetInfo from '@react-native-community/netinfo';

type BranchAuthNavigationProp = StackNavigationProp<
  RootStackParamList,
  'BranchAuth'
>;

type BranchAuthRouteProp = RouteProp<RootStackParamList, 'BranchAuth'>;

interface BranchAuthProps {
  navigation: BranchAuthNavigationProp;
  route: BranchAuthRouteProp;
}

const BranchAuth: React.FC<BranchAuthProps> = ({navigation, route}) => {
  const {branchId, isResubmit} = route.params || {};
  const [form, setForm] = useState({
    name: '',
    branchLocation: '',
    street: '',
    area: '',
    city: '',
    pincode: '',
    branchEmail: '',
    openingTime: '',
    closingTime: '',
    ownerName: '',
    govId: '',
    deliveryServiceAvailable: 'yes' as 'yes' | 'no',
    selfPickup: 'yes' as 'yes' | 'no',
  });

  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isLocationFetched, setIsLocationFetched] = useState(false);
  const [isOpeningTimePickerVisible, setOpeningTimePickerVisible] =
    useState(false);
  const [isClosingTimePickerVisible, setClosingTimePickerVisible] =
    useState(false);
  const [manualLocationEntryMode, setManualLocationEntryMode] = useState(false);
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationServiceEnabled, setIsLocationServiceEnabled] = useState<boolean | null>(null);
  const locationWatchIdRef = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    // Set up AppState listener to detect when app comes to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground, check location service status again
        checkLocationServiceStatus();
      }
      appStateRef.current = nextAppState;
    });
    
    // Clean up when component unmounts
    return () => {
      if (locationWatchIdRef.current !== null) {
        Geolocation.clearWatch(locationWatchIdRef.current);
      }
      subscription.remove();
    };
  }, []);

  // Function to check if location service is enabled
  const checkLocationServiceStatus = useCallback(async () => {
    try {
      // Use a quick Geolocation call to check if service is enabled
      const result = await new Promise<boolean>((resolve) => {
        // Set a timeout in case the request hangs
        const timeoutId = setTimeout(() => {
          resolve(false); // Assume disabled if timeout
        }, 3000);
        
        Geolocation.getCurrentPosition(
          () => {
            clearTimeout(timeoutId);
            resolve(true); // Location service is enabled
          },
          (error) => {
            clearTimeout(timeoutId);
            // Error code 2 means location service is disabled
            if (error.code === 2 || error.message === 'POSITION_UNAVAILABLE') {
              resolve(false);
            } else {
              // For other errors, we assume location service might be enabled
              resolve(true);
            }
          },
          { timeout: 2000, maximumAge: 0 }
        );
      });
      
      setIsLocationServiceEnabled(result);
      return result;
    } catch (error) {
      console.error('Error checking location service:', error);
      setIsLocationServiceEnabled(false);
      return false;
    }
  }, []);
  
  // Direct navigation to location settings
  const openLocationSettings = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        // For Android: try to directly open location settings
        // This intent is specific to location settings
        await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      } else {
        // For iOS or fallback
        Linking.openSettings();
      }
    } catch (error) {
      console.error('Could not open location settings:', error);
      // Fallback to opening general settings
      try {
        await Linking.openSettings();
      } catch (settingsError) {
        console.error('Could not open settings:', settingsError);
        Alert.alert(
          'Location Settings',
          'Please manually enable location services in your device settings.'
        );
      }
    }
  }, []);
  
  useEffect(() => {
    // Check both location permission and service status when component mounts
    const initialChecks = async () => {
      await checkLocationPermission();
      await checkLocationServiceStatus();
    };
    
    initialChecks();
  }, []);
  
  // Check location permission
  const checkLocationPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        setHasLocationPermission(granted);
        storage.set('locationPermission', granted ? 'granted' : 'denied');
      } else {
        // For iOS, we check the stored permission value
        const storedPermission = storage.getString('locationPermission');
        setHasLocationPermission(storedPermission === 'granted');
      }
    } catch (error) {
      console.warn('Error checking location permission:', error);
      // If permission check fails, we default to false
      setHasLocationPermission(false);
    }
  };

  /**
   * Enhanced permission request with fallbacks and detailed error handling
   */
  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        // First, check if permission is already granted
        const alreadyGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        
        if (alreadyGranted) {
          storage.set('locationPermission', 'granted');
          return true;
        }
        
        // Request permission if not granted
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'DKbranch needs access to your location to fetch branch coordinates.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        );
        
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        storage.set('locationPermission', isGranted ? 'granted' : 'denied');
        
        // If permission denied, provide helpful instructions
        if (!isGranted) {
          console.log('Location permission denied by user');
        }
        
        return isGranted;
      } else {
        // iOS handling through Geolocation API
        return new Promise<boolean>(resolve => {
          Geolocation.requestAuthorization(
            () => {
              storage.set('locationPermission', 'granted');
              resolve(true);
            },
            () => {
              storage.set('locationPermission', 'denied');
              resolve(false);
            }
          );
        });
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      reportLocationError(error, 'permission_request');
      return false;
    }
  };

  /**
   * Helper function to get location with better timeout handling
   */
  // Define GeoPosition interface since it's not exposed from the Geolocation module
  interface GeoPosition {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }

  const getLocationWithTimeout = (options: {
    enableHighAccuracy: boolean;
    timeout: number;
    maximumAge: number;
  }): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      // Clear any existing watch
      if (locationWatchIdRef.current !== null) {
        Geolocation.clearWatch(locationWatchIdRef.current);
      }

      // Watch for position updates
      locationWatchIdRef.current = Geolocation.watchPosition(
        position => {
          if (locationWatchIdRef.current !== null) {
            Geolocation.clearWatch(locationWatchIdRef.current);
            locationWatchIdRef.current = null;
          }
          resolve(position);
        },
        error => {
          if (locationWatchIdRef.current !== null) {
            Geolocation.clearWatch(locationWatchIdRef.current);
            locationWatchIdRef.current = null;
          }
          reject(error);
        },
        options
      );

      // Set a backup timeout to clear the watch if it hangs
      setTimeout(() => {
        if (locationWatchIdRef.current !== null) {
          Geolocation.clearWatch(locationWatchIdRef.current);
          locationWatchIdRef.current = null;
          reject(new Error('Location request timed out'));
        }
      }, options.timeout + 2000); // Add 2 seconds buffer
    });
  };

  /**
   * Progressive enhancement location fetching with fallbacks
   */
  const fetchLocation = async (): Promise<GeoPosition> => {
    try {
      // Try high accuracy first (GPS)
      return await getLocationWithTimeout({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      });
    } catch (highAccuracyError) {
      console.warn('High accuracy location failed, trying low accuracy:', highAccuracyError);
      
      // Fall back to low accuracy (network/cell towers)
      try {
        return await getLocationWithTimeout({
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 30000,
        });
      } catch (lowAccuracyError) {
        console.error('Low accuracy location also failed:', lowAccuracyError);
        reportLocationError(lowAccuracyError, 'low_accuracy_fetch');
        throw new Error('Could not fetch location using any method');
      }
    }
  };

  /**
   * Error reporting function
   */
  const reportLocationError = (error: any, context: string) => {
    // Log to console with context
    console.error(`Location error (${context}):`, error);
    
    // Store error details for analytics/reporting
    const errorDetails = {
      errorCode: error.code,
      errorMessage: error.message,
      context,
      timestamp: new Date().toISOString(),
    };
    
    // Set UI error state
    setLocationError(error.message || 'Unknown location error');
    
    // Here you would send to your error tracking service
    // Example: api.logError(errorDetails);
  };

  // Use the openLocationSettings function defined above

  /**
   * Apply manually entered coordinates
   */
  const applyManualCoordinates = useCallback(() => {
    // Validate the manual entries
    const lat = parseFloat(manualLatitude);
    const lng = parseFloat(manualLongitude);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180) values.');
      return;
    }
    
    // Update the form with manual coordinates
    setForm(prev => ({
      ...prev,
      branchLocation: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    }));
    
    setIsLocationFetched(true);
    setManualLocationEntryMode(false);
    ToastAndroid.show('Location set manually', ToastAndroid.SHORT);
  }, [manualLatitude, manualLongitude]);

  /**
   * Check network connectivity before attempting location fetch
   */
  const checkNetworkAndFetchLocation = useCallback(async () => {
    try {
      const networkState = await NetInfo.fetch();
      
      if (!networkState.isConnected) {
        Alert.alert(
          'No Network Connection',
          'Your device is offline. Location services may be limited. Would you like to enter coordinates manually or try anyway?',
          [
            {
              text: 'Enter Manually',
              onPress: () => {
                setManualLocationEntryMode(true);
                setLocationError('No network connection');
              },
            },
            {
              text: 'Try Anyway',
              onPress: () => handleLocationFetching(),
            },
          ]
        );
        return;
      }
      
      // Proceed with location fetching if network is available
      handleLocationFetching();
    } catch (error) {
      console.error('Network check failed:', error);
      // Fall back to attempting location fetch anyway
      handleLocationFetching();
    }
  }, []);

  /**
   * Main location fetching handler with comprehensive error handling
   */
  const handleLocationFetching = useCallback(async () => {
    // Reset error state
    setLocationError(null);
    
    // Check if location service is enabled again just to be sure
    const serviceEnabled = await checkLocationServiceStatus();
    if (!serviceEnabled) {
      Alert.alert(
        'Location Service Disabled',
        'Your device location/GPS service is turned off. Please enable it to fetch your branch location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Enable Location', 
            onPress: openLocationSettings
          },
          {
            text: 'Enter Manually',
            onPress: () => setManualLocationEntryMode(true)
          }
        ]
      );
      return;
    }
    
    // Check if already fetched
    if (isLocationFetched) {
      Alert.alert('Info', 'Location has already been fetched. Do you want to update it?', [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Update',
          onPress: () => {
            setIsLocationFetched(false);
            handleLocationFetching();
          },
        },
      ]);
      return;
    }

    // Confirm user wants to fetch location
    Alert.alert(
      'Confirm Location',
      'Are you sure you are at your shop? This will record your current location.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: async () => {
            // Show loading state
            setIsFetchingLocation(true);
            
            try {
              // Check and request permissions
              const hasPermission = await requestLocationPermission();
              setHasLocationPermission(hasPermission);
              
              if (!hasPermission) {
                // Show helpful message if permission denied
                ToastAndroid.show('Location permission is required', ToastAndroid.LONG);
                
                // Offer manual location entry option
                Alert.alert(
                  'Permission Required',
                  'Location permission denied. Would you like to enter coordinates manually or open settings?',
                  [
                    {
                      text: 'Enter Manually',
                      onPress: () => setManualLocationEntryMode(true),
                    },
                    {
                      text: 'Open Settings',
                      onPress: openLocationSettings,
                    },
                  ]
                );
                return;
              }
              
              // Attempt to fetch location
              try {
                const position = await fetchLocation();
                const { latitude, longitude } = position.coords;
                
                // Update form with precise location
                setForm(prev => ({
                  ...prev,
                  branchLocation: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                }));
                
                setIsLocationFetched(true);
                ToastAndroid.show('Location fetched successfully', ToastAndroid.SHORT);
              } catch (locationError: any) {
                console.error('Location fetch error:', locationError);
                
                // Show helpful error with fallback options
                Alert.alert(
                  'Location Error',
                  'Unable to get your precise location. What would you like to do?',
                  [
                    {
                      text: 'Enter Manually',
                      onPress: () => setManualLocationEntryMode(true),
                    },
                    {
                      text: 'Try Again',
                      onPress: () => handleLocationFetching(),
                    },
                  ]
                );
              }
            } catch (error: any) {
              console.error('General location error:', error);
              Alert.alert('Error', error.message || 'An unexpected error occurred');
            } finally {
              setIsFetchingLocation(false);
            }
          },
        },
      ],
      {cancelable: false},
    );
  }, [hasLocationPermission, isLocationFetched, openLocationSettings]);

  /**
   * Check if location service is enabled before proceeding with location fetch
   */
  const checkLocationServiceBeforeFetch = useCallback(async () => {
    // First check if location service is enabled
    const serviceEnabled = await checkLocationServiceStatus();
    
    if (!serviceEnabled) {
      // Show alert that location service is disabled with option to enable
      Alert.alert(
        'Location Service Disabled',
        'Your device location/GPS service is turned off. Please enable it to fetch your branch location.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Enable Location', 
            onPress: openLocationSettings
          },
          {
            text: 'Enter Manually',
            onPress: () => setManualLocationEntryMode(true)
          }
        ]
      );
      return false;
    }
    
    // If location service is enabled, proceed with network check
    return true;
  }, [checkLocationServiceStatus, openLocationSettings]);

  /**
   * Main entry point for location fetching - first checks service status, then network, then proceeds
   */
  const fetchCurrentLocation = useCallback(async () => {
    const serviceEnabled = await checkLocationServiceBeforeFetch();
    if (serviceEnabled) {
      checkNetworkAndFetchLocation();
    }
  }, [checkLocationServiceBeforeFetch, checkNetworkAndFetchLocation]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateGovId = (govId: string): boolean => {
    const govIdRegex = /^[a-zA-Z0-9]{5,}$/;
    return govIdRegex.test(govId);
  };

  const validatePincode = (pincode: string): boolean => {
    const pincodeRegex = /^\d{6}$/;
    return pincodeRegex.test(pincode);
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };

  const handleOpeningTimeConfirm = (date: Date) => {
    setForm(prev => ({...prev, openingTime: formatTime(date)}));
    setOpeningTimePickerVisible(false);
  };

  const handleClosingTimeConfirm = (date: Date) => {
    setForm(prev => ({...prev, closingTime: formatTime(date)}));
    setClosingTimePickerVisible(false);
  };

  const formatData = useCallback(() => {
    if (!form.name.trim()) {
      throw new Error('Branch name is required.');
    }

    const locationParts = form.branchLocation
      .split(',')
      .map(part => part.trim());
    if (
      locationParts.length !== 2 ||
      isNaN(Number(locationParts[0])) ||
      isNaN(Number(locationParts[1]))
    ) {
      throw new Error(
        'Invalid branch location format. Please enter latitude and longitude separated by a comma (e.g., 12.34, 56.78).',
      );
    }
    const formattedLocation = JSON.stringify({
      latitude: Number(locationParts[0]),
      longitude: Number(locationParts[1]),
    });

    if (!form.street.trim()) {
      throw new Error('Street is required.');
    }

    if (!form.area.trim()) {
      throw new Error('Area is required.');
    }

    if (!form.city.trim()) {
      throw new Error('City is required.');
    }

    if (!form.pincode.trim()) {
      throw new Error('Pincode is required.');
    }

    if (!validatePincode(form.pincode)) {
      throw new Error('Please enter a valid 6-digit pincode.');
    }

    const formattedAddress = JSON.stringify({
      street: form.street.trim(),
      area: form.area.trim(),
      city: form.city.trim(),
      pincode: form.pincode.trim(),
    });

    if (form.branchEmail && !validateEmail(form.branchEmail)) {
      throw new Error('Invalid email format.');
    }

    if (!form.ownerName.trim()) {
      throw new Error('Owner name is required.');
    }

    if (!form.govId || !validateGovId(form.govId)) {
      throw new Error(
        'Please provide a valid government ID (minimum 5 characters, alphanumeric).',
      );
    }

    if (!form.openingTime || !form.closingTime) {
      throw new Error('Please select opening and closing times.');
    }

    return {
      name: form.name.trim(),
      branchLocation: formattedLocation,
      branchAddress: formattedAddress,
      branchEmail: form.branchEmail.trim(),
      openingTime: form.openingTime,
      closingTime: form.closingTime,
      ownerName: form.ownerName.trim(),
      govId: form.govId.trim(),
      deliveryServiceAvailable: form.deliveryServiceAvailable === 'yes',
      selfPickup: form.selfPickup === 'yes',
    };
  }, [form]);

  const handleNext = useCallback(() => {
    try {
      if (
        !form.name ||
        !form.branchLocation ||
        !form.street ||
        !form.area ||
        !form.city ||
        !form.pincode ||
        !form.openingTime ||
        !form.closingTime ||
        !form.ownerName ||
        !form.govId
      ) {
        Alert.alert('Error', 'Please fill all required fields.');
        return;
      }

      const formattedData = formatData();
      navigation.navigate('PhoneNumberScreen', {
        formData: formattedData,
        branchId,
        isResubmit,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid input format.');
    }
  }, [formatData, navigation, form, branchId, isResubmit]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.header}>Branch Registration</Text>
      <Text style={styles.subheader}>Please fill in your branch details</Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Branch Name *</Text>
        <View style={styles.inputContainer}>
          <Icon name="store" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="My Branch Name"
            placeholderTextColor="#95a5a6"
            value={form.name}
            onChangeText={text => setForm(prev => ({...prev, name: text}))}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>
          Branch Location (latitude, longitude) *
        </Text>
        <View style={styles.locationContainer}>
          <View style={styles.inputWrapper}>
            <Icon
              name="location-on"
              size={20}
              color="#7f8c8d"
              style={styles.icon}
            />
            <TextInput
              placeholder="e.g., 12.34, 56.78"
              placeholderTextColor="#95a5a6"
              value={form.branchLocation}
              onChangeText={text =>
                !isLocationFetched &&
                setForm(prev => ({...prev, branchLocation: text}))
              }
              style={[styles.input, isLocationFetched && styles.inputDisabled]}
              editable={!isLocationFetched && !manualLocationEntryMode}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.fetchButton,
              (isFetchingLocation || isLocationFetched || manualLocationEntryMode) &&
                styles.fetchButtonDisabled,
            ]}
            onPress={fetchCurrentLocation}
            disabled={
              isFetchingLocation || isLocationFetched || manualLocationEntryMode
            }>
            {isFetchingLocation ? (
              <ActivityIndicator color="#2ecc71" />
            ) : (
              <Icon name="my-location" size={20} color="#2ecc71" />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Manual location entry mode */}
        {manualLocationEntryMode && (
          <View style={styles.manualLocationContainer}>
            <Text style={styles.manualLocationLabel}>Enter Coordinates Manually:</Text>
            <View style={styles.coordInputContainer}>
              <View style={styles.coordInputWrapper}>
                <Text style={styles.coordLabel}>Latitude:</Text>
                <TextInput
                  placeholder="e.g., 12.9716"
                  placeholderTextColor="#95a5a6"
                  keyboardType="decimal-pad"
                  value={manualLatitude}
                  onChangeText={setManualLatitude}
                  style={styles.coordInput}
                />
              </View>
              <View style={styles.coordInputWrapper}>
                <Text style={styles.coordLabel}>Longitude:</Text>
                <TextInput
                  placeholder="e.g., 77.5946"
                  placeholderTextColor="#95a5a6"
                  keyboardType="decimal-pad"
                  value={manualLongitude}
                  onChangeText={setManualLongitude}
                  style={styles.coordInput}
                />
              </View>
              <View style={styles.coordButtonsContainer}>
                <TouchableOpacity 
                  style={styles.applyButton}
                  onPress={applyManualCoordinates}>
                  <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setManualLocationEntryMode(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        
        {/* Show permission warnings if needed */}
        {(!hasLocationPermission || isLocationServiceEnabled === false) && !manualLocationEntryMode && (
          <View style={styles.permissionContainer}>
            {!hasLocationPermission && (
              <Text style={styles.permissionText}>
                Location permission is required to fetch your current location.
              </Text>
            )}
            {isLocationServiceEnabled === false && (
              <Text style={styles.permissionText}>
                Location service (GPS) is disabled on your device.
              </Text>
            )}
            <TouchableOpacity onPress={openLocationSettings} style={styles.settingsButton}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setManualLocationEntryMode(true)} 
              style={styles.manualEntryButton}>
              <Text style={styles.manualEntryButtonText}>Enter Manually</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {isLocationServiceEnabled === false && !manualLocationEntryMode && (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionText}>
              Location service (GPS) is disabled on your device.
            </Text>
            <TouchableOpacity onPress={openLocationSettings} style={styles.settingsButton}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setManualLocationEntryMode(true)} 
              style={styles.manualEntryButton}>
              <Text style={styles.manualEntryButtonText}>Enter Manually</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {locationError && !manualLocationEntryMode && (
          <Text style={styles.errorText}>{locationError}</Text>
        )}
        
        {isLocationFetched && (
          <Text style={styles.infoText}>
            Location has been fetched and is now locked.
          </Text>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Branch Address *</Text>

        <View style={styles.addressFieldContainer}>
          <Text style={styles.addressLabel}>Street *</Text>
          <View style={styles.inputContainer}>
            <Icon name="home" size={20} color="#7f8c8d" style={styles.icon} />
            <TextInput
              placeholder="Street"
              placeholderTextColor="#95a5a6"
              value={form.street}
              onChangeText={text => setForm(prev => ({...prev, street: text}))}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.addressFieldContainer}>
          <Text style={styles.addressLabel}>Area *</Text>
          <View style={styles.inputContainer}>
            <Icon name="place" size={20} color="#7f8c8d" style={styles.icon} />
            <TextInput
              placeholder="Area"
              placeholderTextColor="#95a5a6"
              value={form.area}
              onChangeText={text => setForm(prev => ({...prev, area: text}))}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.addressFieldContainer}>
          <Text style={styles.addressLabel}>City *</Text>
          <View style={styles.inputContainer}>
            <Icon
              name="location-city"
              size={20}
              color="#7f8c8d"
              style={styles.icon}
            />
            <TextInput
              placeholder="City,State"
              placeholderTextColor="#95a5a6"
              value={form.city}
              onChangeText={text => setForm(prev => ({...prev, city: text}))}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.addressFieldContainer}>
          <Text style={styles.addressLabel}>Pincode *</Text>
          <View style={styles.inputContainer}>
            <Icon name="pin" size={20} color="#7f8c8d" style={styles.icon} />
            <TextInput
              placeholder="e.g., 500027"
              placeholderTextColor="#95a5a6"
              value={form.pincode}
              onChangeText={text => setForm(prev => ({...prev, pincode: text}))}
              keyboardType="numeric"
              maxLength={6}
              style={styles.input}
            />
          </View>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Branch Email</Text>
        <View style={styles.inputContainer}>
          <Icon name="email" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="Enter email address"
            placeholderTextColor="#95a5a6"
            value={form.branchEmail}
            onChangeText={text =>
              setForm(prev => ({...prev, branchEmail: text}))
            }
            keyboardType="email-address"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Opening Time *</Text>
        <View style={styles.inputContainer}>
          <Icon
            name="access-time"
            size={20}
            color="#7f8c8d"
            style={styles.icon}
          />
          <TouchableOpacity
            onPress={() => setOpeningTimePickerVisible(true)}
            style={styles.timePickerButton}>
            <Text
              style={[
                styles.input,
                form.openingTime ? styles.inputText : styles.placeholderText,
              ]}>
              {form.openingTime || 'Select opening time'}
            </Text>
          </TouchableOpacity>
        </View>
        <DateTimePickerModal
          isVisible={isOpeningTimePickerVisible}
          mode="time"
          onConfirm={handleOpeningTimeConfirm}
          onCancel={() => setOpeningTimePickerVisible(false)}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Closing Time *</Text>
        <View style={styles.inputContainer}>
          <Icon
            name="access-time"
            size={20}
            color="#7f8c8d"
            style={styles.icon}
          />
          <TouchableOpacity
            onPress={() => setClosingTimePickerVisible(true)}
            style={styles.timePickerButton}>
            <Text
              style={[
                styles.input,
                form.closingTime ? styles.inputText : styles.placeholderText,
              ]}>
              {form.closingTime || 'Select closing time'}
            </Text>
          </TouchableOpacity>
        </View>
        <DateTimePickerModal
          isVisible={isClosingTimePickerVisible}
          mode="time"
          onConfirm={handleClosingTimeConfirm}
          onCancel={() => setClosingTimePickerVisible(false)}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Owner Name *</Text>
        <View style={styles.inputContainer}>
          <Icon name="person" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="Enter owner name"
            placeholderTextColor="#95a5a6"
            value={form.ownerName}
            onChangeText={text => setForm(prev => ({...prev, ownerName: text}))}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Government ID *</Text>
        <View style={styles.inputContainer}>
          <Icon name="badge" size={20} color="#7f8c8d" style={styles.icon} />
          <TextInput
            placeholder="Adhaar, PAN, etc."
            placeholderTextColor="#95a5a6"
            value={form.govId}
            onChangeText={text => setForm(prev => ({...prev, govId: text}))}
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Delivery Service Available *</Text>
        <View style={[styles.inputContainer, styles.pickerContainer]}>
          <Icon
            name="local-shipping"
            size={20}
            color="#7f8c8d"
            style={styles.icon}
          />
          <Picker
            selectedValue={form.deliveryServiceAvailable}
            onValueChange={value =>
              setForm(prev => ({...prev, deliveryServiceAvailable: value}))
            }
            style={styles.picker}
            mode="dropdown"
            dropdownIconColor="#7f8c8d"
            enabled={true}
            itemStyle={styles.pickerItemStyle}>
            <Picker.Item label="Yes" value="yes" color="#2c3e50" />
            <Picker.Item label="No" value="no" color="#2c3e50" />
          </Picker>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Self Pickup *</Text>
        <View style={[styles.inputContainer, styles.pickerContainer]}>
          <Icon
            name="shopping-cart"
            size={20}
            color="#7f8c8d"
            style={styles.icon}
          />
          <Picker
            selectedValue={form.selfPickup}
            onValueChange={value =>
              setForm(prev => ({...prev, selfPickup: value}))
            }
            style={styles.picker}
            mode="dropdown"
            dropdownIconColor="#7f8c8d"
            enabled={true}
            itemStyle={styles.pickerItemStyle}>
            <Picker.Item label="Yes" value="yes" color="#2c3e50" />
            <Picker.Item label="No" value="no" color="#2c3e50" />
          </Picker>
        </View>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>
          {isResubmit ? 'Next (Resubmit)' : 'Next'}
        </Text>
        <Icon name="arrow-forward" size={20} color="white" />
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subheader: {
    fontSize: 16,
    marginBottom: 20,
    color: '#7f8c8d',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#2c3e50',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#2c3e50',
  },
  inputText: {
    color: '#2c3e50',
  },
  placeholderText: {
    color: '#95a5a6',
  },
  inputDisabled: {
    backgroundColor: '#ecf0f1',
    color: '#7f8c8d',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#f9f9f9',
  },
  fetchButton: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    marginLeft: 10,
  },
  fetchButtonDisabled: {
    opacity: 0.5,
  },
  // Manual location entry styles
  manualLocationContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  manualLocationLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2c3e50',
  },
  coordInputContainer: {
    width: '100%',
  },
  coordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  coordLabel: {
    width: 80,
    fontSize: 14,
    color: '#7f8c8d',
  },
  coordInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  coordButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  applyButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
    marginRight: 10,
  },
  applyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  cancelButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Permission container styles
  permissionContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  permissionText: {
    color: '#e74c3c',
    fontSize: 14,
    marginBottom: 8,
  },
  settingsButton: {
    backgroundColor: '#3498db',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  settingsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  manualEntryButton: {
    backgroundColor: '#f39c12',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  manualEntryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  errorText: {
    marginTop: 8,
    color: '#e74c3c',
    fontSize: 14,
  },
  infoText: {
    marginTop: 8,
    color: '#2ecc71',
    fontSize: 14,
  },
  addressFieldContainer: {
    marginTop: 10,
  },
  addressLabel: {
    fontSize: 14,
    marginBottom: 5,
    color: '#7f8c8d',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginTop: 10,
    height: 50,
  },
  picker: {
    flex: 1,
    height: 50,
    color: '#2c3e50',
    marginLeft: Platform.OS === 'android' ? -10 : 0, // Fix alignment on Android
  },
  pickerItemStyle: {
    fontSize: 16,
    height: 120,
  },
  timePickerButton: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
  },
  buttonContainer: {
    marginTop: 30,
  },
  nextButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
    marginBottom: 15,
    gap: 10,
  },
});

export default BranchAuth;
