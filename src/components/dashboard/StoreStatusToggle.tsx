import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, StyleSheet, Text, Alert} from 'react-native';
import SwitchSelector from 'react-native-switch-selector';
import {useStore} from '../../store/ordersStore';
import {getStoreStatus, updateStoreStatus} from '../../services/api';
import socketService from '../../services/socket';
import {OrderSocket} from '../../native/OrderSocket'; // Import OrderSocket

const MINIMUM_BALANCE = -100;

interface StoreStatusToggleProps {
  setShowLowBalanceModal: (show: boolean) => void;
}

const StoreStatusToggle: React.FC<StoreStatusToggleProps> = ({
  setShowLowBalanceModal,
}) => {
  const {storeStatus, setStoreStatus, walletBalance} = useStore();
  const [isDisabled, setIsDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isToggling = useRef(false);
  const switchRef = useRef<any>(null);

  // Fetch initial storeStatus from server
  useEffect(() => {
    const syncStoreStatus = async () => {
      try {
        const response = await getStoreStatus();
        setStoreStatus(response.storeStatus);
        OrderSocket.setStoreStatus(response.storeStatus === 'open'); // Sync with native module

        // Check wallet balance
        if (response.balance < MINIMUM_BALANCE) {
          setIsDisabled(true);
          setErrorMessage('Store cannot be opened: Balance below -₹100');
        } else {
          setIsDisabled(false);
          setErrorMessage(null);
        }
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
      storeStatus: string;
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

      // Handle balance updates
      if (data.balance !== undefined && data.balance < MINIMUM_BALANCE) {
        setIsDisabled(true);
        setErrorMessage('Store cannot be opened: Balance below -₹100');
      }
    };

    socket.on('syncmart:status', handleStatusUpdate);
    return () => {
      socket.off('syncmart:status', handleStatusUpdate);
    };
  }, [storeStatus, setStoreStatus]);

  // Watch wallet balance changes
  useEffect(() => {
    if (walletBalance < MINIMUM_BALANCE) {
      setIsDisabled(true);
      setErrorMessage('Store cannot be opened: Balance below -₹100');

      // Auto-close store if it's open
      if (storeStatus === 'open') {
        toggleSyncMartStatus(1);
      }
    } else {
      setIsDisabled(false);
      setErrorMessage(null);
    }
  }, [walletBalance, storeStatus]);

  const toggleSyncMartStatus = useCallback(
    async (value: number) => {
      const newStatus = value === 0 ? ('open' as const) : ('closed' as const);
      if (newStatus === storeStatus) return;

      // Prevent opening store with low balance
      if (newStatus === 'open' && walletBalance < MINIMUM_BALANCE) {
        Alert.alert(
          'Cannot Open Store',
          'Your wallet balance is below -₹100. Please add funds to open the store.',
        );
        // Revert switch position
        if (switchRef.current) {
          switchRef.current.setValue(1);
        }
        return;
      }

      isToggling.current = true;
      try {
        const response = await updateStoreStatus(newStatus);
        setStoreStatus(response.storeStatus);
        OrderSocket.setStoreStatus(response.storeStatus === 'open'); // Sync with native module

        if (response.reason) {
          setErrorMessage(response.reason);
        } else {
          setErrorMessage(null);
        }
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
    [storeStatus, setStoreStatus, walletBalance],
  );

  const handleTogglePress = useCallback(
    (value: number) => {
      if (isDisabled) {
        // Show low balance modal when disabled toggle is tapped
        setShowLowBalanceModal(true);
        return;
      }
      toggleSyncMartStatus(value);
    },
    [isDisabled, toggleSyncMartStatus, setShowLowBalanceModal],
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
        backgroundColor={isDisabled ? '#E0E0E0' : 'rgba(255, 255, 255, 0.3)'}
        borderColor={isDisabled ? '#CCCCCC' : '#007AFF'}
        selectedColor={isDisabled ? '#999999' : '#007AFF'}
        style={styles.switch}
        disabled={false} // Remove disabled prop to allow tap events
      />
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
});

export default StoreStatusToggle;
