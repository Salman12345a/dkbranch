import React, {useCallback, useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import SwitchSelector from 'react-native-switch-selector';
import {useStore} from '../../store/ordersStore';
import api from '../../services/api';

interface DeliveryServiceToggleProps {
  socket: any;
}

const DeliveryServiceToggle: React.FC<DeliveryServiceToggleProps> = ({
  socket,
}) => {
  const {
    deliveryServiceAvailable,
    setDeliveryServiceAvailable,
    hasApprovedDeliveryPartner,
  } = useStore();

  // Track the UI state separately from the confirmed state
  const [uiState, setUiState] = useState(deliveryServiceAvailable);
  const confirmedState = useRef(deliveryServiceAvailable);
  const isToggling = useRef(false);

  // Synchronize states when the confirmed state changes
  useEffect(() => {
    confirmedState.current = deliveryServiceAvailable;
    setUiState(deliveryServiceAvailable);
  }, [deliveryServiceAvailable]);

  // Socket handler with strict validation
  useEffect(() => {
    if (!socket) return;

    const handleDeliveryUpdate = (data: {
      deliveryServiceAvailable: boolean;
    }) => {
      if (isToggling.current) return;

      if (typeof data?.deliveryServiceAvailable !== 'boolean') {
        console.warn('Invalid socket data format');
        return;
      }

      if (data.deliveryServiceAvailable !== confirmedState.current) {
        confirmedState.current = data.deliveryServiceAvailable;
        setDeliveryServiceAvailable(data.deliveryServiceAvailable);
      }
    };

    socket.on('syncmart:delivery-service-available', handleDeliveryUpdate);
    return () => {
      socket.off('syncmart:delivery-service-available', handleDeliveryUpdate);
    };
  }, [socket, setDeliveryServiceAvailable]);

  const toggleDelivery = useCallback(async () => {
    const newEnabled = !uiState;

    // Block if already toggling or no state change
    if (isToggling.current || newEnabled === confirmedState.current) {
      return;
    }

    // Block if trying to enable without approved partner
    if (newEnabled && !hasApprovedDeliveryPartner()) {
      console.log('Enable blocked: No approved partner');
      return;
    }

    isToggling.current = true;
    setUiState(newEnabled); // Optimistic UI update

    try {
      const response = await api.patch('/syncmarts/delivery', {
        enable: newEnabled,
      });

      // Strict response validation
      if (response.data?.deliveryServiceAvailable === newEnabled) {
        confirmedState.current = newEnabled;
        setDeliveryServiceAvailable(newEnabled);

        if (socket?.connected) {
          socket.emit('syncmart:delivery-service-available', {
            deliveryServiceAvailable: newEnabled,
          });
        }
      } else {
        throw new Error('API response mismatch');
      }
    } catch (err) {
      console.error('Toggle failed:', err);
      // Revert to confirmed state on error
      setUiState(confirmedState.current);
    } finally {
      isToggling.current = false;
    }
  }, [
    uiState,
    hasApprovedDeliveryPartner,
    socket,
    setDeliveryServiceAvailable,
  ]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Delivery Service: {uiState ? 'Enabled' : 'Disabled'}
      </Text>
      <SwitchSelector
        options={[
          {label: 'Enabled', value: 'enabled'},
          {label: 'Disabled', value: 'disabled'},
        ]}
        initial={uiState ? 0 : 1}
        selectedColor="#fff"
        buttonColor="#007AFF"
        backgroundColor="#fff"
        borderColor="#007AFF"
        value={uiState ? 0 : 1}
        onPress={toggleDelivery}
        disabled={!uiState && !hasApprovedDeliveryPartner()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {marginVertical: 20},
  label: {marginBottom: 10, fontSize: 16},
});

export default DeliveryServiceToggle;
