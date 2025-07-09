import React, {useEffect, useCallback, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import {useStore} from '../../../store/ordersStore';
import {fetchBranchStatus, validateToken} from '../../../services/api';
import socketService from '../../../services/socket';
import {storage} from '../../../utils/storage';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/types';
import CongratulationsModal from '../../../components/common/CongratulationsModal';

type StatusScreenProps = StackScreenProps<RootStackParamList, 'Status'>;

const StatusScreen: React.FC<StatusScreenProps> = ({route, navigation}) => {
  const {branchId} = route?.params || {};
  if (!branchId) {
    console.error('No branchId provided in route params');
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: No branch ID provided</Text>
      </SafeAreaView>
    );
  }

  // Use stable store references
  const branches = useStore(state => state.branches);
  const addBranch = useStore(state => state.addBranch);
  const updateBranchStatus = useStore(state => state.updateBranchStatus);

  const [branchStatus, setBranchStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCongratulations, setShowCongratulations] = useState(false);
  const hasFetched = useRef(false);
  const isMounted = useRef(true);
  const lottieRef = useRef<LottieView>(null);

  // Memoize branch lookup to prevent unnecessary re-renders
  const branch = React.useMemo(
    () => branches.find(b => b.id === branchId),
    [branches, branchId],
  );

  // Get animation source based on status
  const getAnimationSource = (status: string | null) => {
    switch (status) {
      case 'pending':
        return require('../../../assets/animations/pending.json');
      case 'approved':
        return require('../../../assets/animations/approved.json');
      case 'rejected':
        return require('../../../assets/animations/reject.json');
      default:
        return require('../../../assets/animations/pending.json');
    }
  };

  // Stable callback with minimal dependencies
  const syncBranchStatus = useCallback(async () => {
    if (hasFetched.current || isLoading || !isMounted.current) return;

    setIsLoading(true);
    try {
      console.log('syncBranchStatus called with branchId:', branchId);
      const response = await fetchBranchStatus(branchId);
      console.log('Fetched status:', response.status);

      if (!isMounted.current) return;

      const existingBranch = branches.find(b => b.id === branchId);
      if (!existingBranch) {
        console.log('Adding new branch to store:', response);
        addBranch({
          id: response.branchId,
          status: response.status,
          name: response.name || '',
          phone: response.phone || '',
          address: response.address || {
            street: '',
            area: '',
            city: '',
            pincode: '',
          },
          location: response.location || {
            type: 'Point',
            coordinates: [0, 0],
          },
          branchEmail: response.branchEmail || '',
          openingTime: response.openingTime || '',
          closingTime: response.closingTime || '',
          ownerName: response.ownerName || '',
          govId: response.govId || '',
          deliveryServiceAvailable: response.deliveryServiceAvailable || false,
          selfPickup: response.selfPickup || false,
          branchfrontImage: response.branchfrontImage || '',
          ownerIdProof: response.ownerIdProof || '',
          ownerPhoto: response.ownerPhoto || '',
        });
      } else if (existingBranch.status !== response.status) {
        console.log('Updating branch status:', response.status);
        updateBranchStatus(branchId, response.status);
      }

      setBranchStatus(response.status);
      hasFetched.current = true;

      if (response.status === 'approved') {
        storage.set('isApproved', true);
      }

      // Play animation when status changes
      if (lottieRef.current) {
        lottieRef.current.play();
      }
    } catch (error) {
      console.error('Failed to sync branch status:', error);
      hasFetched.current = false;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [branchId, addBranch, updateBranchStatus]);

  useEffect(() => {
    console.log('useEffect running for branchId:', branchId);
    isMounted.current = true;

    // Only fetch if not already fetched
    if (!hasFetched.current && !branchStatus) {
      syncBranchStatus();
    }

    return () => {
      isMounted.current = false;
    };
  }, [branchId, syncBranchStatus, branchStatus]);

  // Handle socket connection separately
  useEffect(() => {
    let socketConnected = false;
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout | null = null;

    const connectSocket = async () => {
      if (socketConnected) return;

      try {
        const phone = await AsyncStorage.getItem('branchPhone');
        if (phone && !socketService.getConnectionStatus().isConnected) {
          console.log(
            `Connecting socket with phone (attempt ${
              retryCount + 1
            }/${maxRetries}):`,
            phone,
          );
          socketService.connectBranchRegistration(phone);

          // Check if connection was successful after a short delay
          setTimeout(() => {
            if (socketService.getConnectionStatus().isConnected) {
              console.log('Socket connection successful');
              socketConnected = true;
              retryCount = 0;
            } else if (retryCount < maxRetries) {
              console.log('Socket connection failed, scheduling retry');
              retryCount++;
              retryTimeout = setTimeout(connectSocket, 2000); // Retry after 2 seconds
            } else {
              console.log(
                'Max retries reached, giving up on socket connection',
              );
            }
          }, 1000);
        }
      } catch (error) {
        console.log('Error connecting socket:', error);
        if (retryCount < maxRetries) {
          retryCount++;
          retryTimeout = setTimeout(connectSocket, 2000);
        }
      }
    };

    connectSocket();

    return () => {
      // Cleanup timeouts on unmount
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, []);

  // Play animation when component mounts
  useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.play();
    }
  }, [branchStatus]);

  const handleWelcomeClick = useCallback(async () => {
    try {
      console.log('Welcome clicked');
      setIsLoading(true);

      // Set as approved in storage
      storage.set('isApproved', true);
      storage.set('isRegistered', true);
      storage.set('branchId', branchId);

      // Store user ID if not stored already
      const currentUserId = useStore.getState().userId || branchId;
      if (!useStore.getState().userId) {
        storage.set('userId', currentUserId);
        useStore.getState().setUserId(currentUserId);
      }

      // Clear any existing token to force a fresh login
      storage.delete('accessToken');

      // Show celebration modal instead of alert
      setIsLoading(false);
      setShowCongratulations(true);
    } catch (error) {
      console.error('Welcome button error:', error);
      setIsLoading(false);
    }
  }, [branchId]);

  const handleCongratulationsClose = useCallback(() => {
    setShowCongratulations(false);
    // Navigate to Authentication screen
    navigation.reset({
      index: 0,
      routes: [{name: 'Authentication' as any}],
    });
  }, [navigation]);

  const handleRetry = useCallback(() => {
    console.log('Retry clicked');
    hasFetched.current = false;
    syncBranchStatus();
  }, [syncBranchStatus]);

  const handleResubmit = useCallback(() => {
    console.log('Resubmit clicked');
    navigation.navigate('BranchAuth' as any, {branchId, isResubmit: true});
  }, [navigation, branchId]);

  const currentStatus = branchStatus || branch?.status;
  const branchName = branch?.name || 'Your Branch';

  const getStatusMessage = (status: string | null) => {
    switch (status) {
      case 'pending':
        return 'Your branch application is under review';
      case 'approved':
        return 'Congratulations! Your branch has been approved!';
      case 'rejected':
        return 'Your branch registration was rejected';
      default:
        return 'Status unavailable';
    }
  };

  const getStatusDescription = (status: string | null) => {
    switch (status) {
      case 'pending':
        return 'Please wait while our team reviews your application. This process usually takes 24-48 hours.';
      case 'approved':
        return 'You can now access all DKbranch features and start managing your business.';
      case 'rejected':
        return 'Please check the whatsapp we sent the rejection reason and resubmit your application with the necessary corrections.';
      default:
        return 'Unable to retrieve your status. Please try again later.';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <View style={styles.animationContainer}>
          <LottieView
            ref={lottieRef}
            source={getAnimationSource(currentStatus)}
            style={styles.animation}
            autoPlay
            loop={
              currentStatus === 'pending' ||
              currentStatus === 'approved' ||
              currentStatus === 'rejected'
            }
          />
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.statusTitle}>
            {getStatusMessage(currentStatus)}
          </Text>
          <Text style={styles.statusDescription}>
            {getStatusDescription(currentStatus)}
          </Text>

          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loaderText}>Processing...</Text>
            </View>
          ) : (
            <View style={styles.buttonsContainer}>
              {currentStatus === 'approved' && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleWelcomeClick}
                  disabled={isLoading}>
                  <Text style={styles.primaryButtonText}>
                    Continue to Dashboard
                  </Text>
                </TouchableOpacity>
              )}

              {currentStatus === 'rejected' && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleResubmit}
                  disabled={isLoading}>
                  <Text style={styles.secondaryButtonText}>
                    Update & Resubmit
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Congratulations Modal */}
        <CongratulationsModal
          visible={showCongratulations}
          branchName={branchName}
          onClose={handleCongratulationsClose}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  animationContainer: {
    marginTop: 252,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: 340,
    height: 340,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusDescription: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  loaderContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  buttonsContainer: {
    marginTop: 16,
  },
  refreshButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StatusScreen;
