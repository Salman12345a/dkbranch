import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, StyleSheet, Alert, Text} from 'react-native';
import SwitchSelector from 'react-native-switch-selector';
import {useStore} from '../../store/ordersStore';
import {getStoreStatus, updateStoreStatus} from '../../services/api';
import socketService from '../../services/socket';
import {OrderSocket} from '../../native/OrderSocket'; // Import OrderSocket
import {useAdMob} from '../../hooks/useAdMob';


interface StoreStatusToggleProps {
  setShowLowBalanceModal: (show: boolean) => void;
}

const StoreStatusToggle: React.FC<StoreStatusToggleProps> = ({
  setShowLowBalanceModal,
}) => {
  const {storeStatus, setStoreStatus} = useStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isToggling = useRef(false);
  const switchRef = useRef<any>(null);
  
  // AdMob integration with safe error handling
  let showRewardedAd: any = null;
  let isRewardedAdReady = false;
  let isShowingAd = false;
  
  try {
    const adMobHook = useAdMob();
    showRewardedAd = adMobHook.showRewardedAd;
    isRewardedAdReady = adMobHook.isRewardedAdReady;
    isShowingAd = adMobHook.isShowingAd;
  } catch (error) {
    console.warn('[StoreStatusToggle] AdMob hook failed, continuing without ads:', error);
  }

  // Fetch initial storeStatus from server
  useEffect(() => {
    const syncStoreStatus = async () => {
      try {
        const response = await getStoreStatus();
        setStoreStatus(response.storeStatus);
        OrderSocket.setStoreStatus(response.storeStatus === 'open'); // Sync with native module

        setErrorMessage(null);
      } catch (error) {
        console.error('Error fetching storeStatus:', error);
        setErrorMessage('Failed to fetch store status');
      }
    };

    syncStoreStatus();
  }, [setStoreStatus]);

  // Socket setup for syncmart:status and wallet updates
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleStatusUpdate = (data: {
      storeStatus: 'open' | 'closed';
      balance?: number;
    }) => {
      if (isToggling.current) return;

      if (data.storeStatus !== storeStatus) {
        setStoreStatus(data.storeStatus);
        OrderSocket.setStoreStatus(data.storeStatus === 'open'); // Sync with native module
        // Force update switch position without triggering onPress
        if (switchRef.current) {
          switchRef.current.setValue(data.storeStatus === 'open' ? 0 : 1);
        }
      }
    };

    socket.on('syncmart:status', handleStatusUpdate);
    return () => {
      socket.off('syncmart:status', handleStatusUpdate);
    };
  }, [storeStatus, setStoreStatus]);


  const toggleSyncMartStatus = useCallback(
    async (value: number) => {
      const newStatus = value === 0 ? ('open' as const) : ('closed' as const);
      if (newStatus === storeStatus) return;

      isToggling.current = true;

      try {
        // Try to show rewarded ad if available
        if (showRewardedAd && isRewardedAdReady) {
          try {
            console.log('Attempting to show rewarded ad...');
            const adWatched = await showRewardedAd({
              onComplete: (success: boolean, reward: any) => {
                console.log('Ad completed:', success, reward);
              },
              onError: (error: any) => {
                console.warn('Ad error:', error);
              },
              timeout: 15000,
            });
            console.log('Ad result:', adWatched);
          } catch (adError: any) {
            console.error('Ad failed, but continuing with status change:', adError);
          }
        } else {
          console.log('No ad available or not ready, proceeding with status change');
        }

        // Proceed with status change
        console.log('Updating store status to:', newStatus);
        const response = await updateStoreStatus(newStatus);
        setStoreStatus(response.storeStatus);
        OrderSocket.setStoreStatus(response.storeStatus === 'open'); // Sync with native module

        if (response.reason) {
          setErrorMessage(response.reason);
        } else {
          setErrorMessage(null);
        }

        console.log('Status changed successfully');
      } catch (err: any) {
        console.error('Toggle Error:', err);
        Alert.alert('Error', err.message || 'Failed to update store status');
        // Revert switch position if API call fails
        if (switchRef.current) {
          switchRef.current.setValue(storeStatus === 'open' ? 0 : 1);
        }
      } finally {
        setTimeout(() => {
          isToggling.current = false;
        }, 1500);
      }
    },
    [storeStatus, setStoreStatus],
  );

  const handleTogglePress = useCallback(
    (value: number) => {
      toggleSyncMartStatus(value);
    },
    [toggleSyncMartStatus],
  );

  return (
    <View style={styles.container}>
      <SwitchSelector
        ref={switchRef}
        options={[
          {label: 'Open', value: 0},
          {label: 'Closed', value: 1},
        ]}
        initial={storeStatus === 'open' ? 0 : 1}
        value={storeStatus === 'open' ? 0 : 1}
        onPress={handleTogglePress}
        buttonColor="#FFFFFF"
        backgroundColor={isShowingAd ? '#E0E0E0' : 'rgba(255, 255, 255, 0.3)'}
        borderColor={isShowingAd ? '#CCCCCC' : '#007AFF'}
        selectedColor={isShowingAd ? '#999999' : '#007AFF'}
        style={styles.switch}
        disabled={isShowingAd}
      />
      {isShowingAd && (
        <Text style={styles.adStatusText}>Watching ad...</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 150,
    alignItems: 'center',
  },
  switch: {
    paddingVertical: 5,
  },
  errorMessage: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    maxWidth: 200,
  },
  adStatusText: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 5,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default StoreStatusToggle;
