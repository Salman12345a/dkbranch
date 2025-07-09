import 'react-native-gesture-handler';
import React, {useEffect, useCallback} from 'react';
import {
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import {useStore} from './src/store/ordersStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  OrderSocket,
  OrderSocketEventEmitter,
  OrderSocketEvents,
} from './src/native/OrderSocket';
import NetworkAlert from './src/components/common/NetworkAlert';
import {config} from './src/config';
import FCMService from './src/services/FCMService';
import messaging from '@react-native-firebase/messaging';
import NotificationPermission from './src/components/common/NotificationPermission';

export const navigationRef = React.createRef<NavigationContainerRef<any>>();

const App = () => {
  const {
    userId,
    setUserId,
    addOrder,
    updateOrder,
    setWalletBalance,
    addWalletTransaction,
  } = useStore();

  const handleNewOrder = useCallback(
    (orderData: any) => {
      try {
        const order = JSON.parse(orderData.orderData);
        addOrder(order);
      } catch (error) {
        console.error('[Socket] Error parsing new order:', error);
      }
    },
    [addOrder],
  );

  const handleOrderUpdate = useCallback(
    (data: any) => {
      try {
        const order = JSON.parse(data.orderData);
        updateOrder(data.orderId, order);
      } catch (error) {
        console.error('[Socket] Error parsing order update:', error);
      }
    },
    [updateOrder],
  );

  const handleWalletUpdate = useCallback(
    (data: any) => {
      try {
        const {newBalance, transaction} = data;
        setWalletBalance(newBalance);
        if (transaction) {
          const parsedTransaction = JSON.parse(transaction);
          addWalletTransaction({
            ...parsedTransaction,
            timestamp: parsedTransaction.timestamp,
            status:
              parsedTransaction.type === 'platform_charge'
                ? 'settled'
                : 'pending',
            orderNumber: parsedTransaction.orderId,
          });
        }
      } catch (error) {
        console.error('[Socket] Error handling wallet update:', error);
      }
    },
    [setWalletBalance, addWalletTransaction],
  );

  // Initialize FCM
  useEffect(() => {
    FCMService.init().catch(error => {
      console.error('Failed to initialize FCM:', error);
    });
    
    // Handle notification click when app is in background or terminated
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app:', remoteMessage);
      // Handle navigation if needed
      if (navigationRef.current && remoteMessage.data?.orderId) {
        // Navigate to order details
        navigationRef.current.navigate('OrderDetails', {
          orderId: remoteMessage.data.orderId,
        });
      }
    });
    
    // Check if app was opened from a notification (app in quit state)
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from quit state by notification:', remoteMessage);
        // We will navigate once the app is fully loaded
        // Store the notification data to use after login
        AsyncStorage.setItem('initialNotification', JSON.stringify(remoteMessage));
      }
    });
  }, []);

  useEffect(() => {
    let isInitialConnection = true;

    const restoreUserId = async () => {
      try {
        const storedBranchId = await AsyncStorage.getItem('branchId');
        const token = await AsyncStorage.getItem('accessToken');

        if (storedBranchId && token && !userId) {
          setUserId(storedBranchId);

          // Only connect socket and fetch orders on initial mount
          if (isInitialConnection) {
            try {
              // First set the API base URL from config before connecting
              console.log('[Socket] Setting API base URL:', config.BASE_URL);
              await OrderSocket.setApiBaseUrl(config.BASE_URL);
              
              // Then connect to socket
              await OrderSocket.connect(storedBranchId, token);
              const recentOrders = await OrderSocket.getRecentOrders(
                storedBranchId,
              );

              recentOrders.forEach(order => {
                try {
                  const parsedOrder = JSON.parse(order.orderData);
                  addOrder(parsedOrder);
                } catch (error) {
                  console.error('[Socket] Error parsing stored order:', error);
                }
              });
            } catch (error) {
              console.error(
                '[Socket] Failed to connect or fetch orders:',
                error,
              );
            }
            isInitialConnection = false;
          }
        }
        
        // Check if app was opened from notification and handle navigation
        const handleInitialNotification = async () => {
          try {
            const initialNotificationStr = await AsyncStorage.getItem('initialNotification');
            if (initialNotificationStr) {
              const initialNotification = JSON.parse(initialNotificationStr);
              if (initialNotification.data?.orderId) {
                setTimeout(() => {
                  navigationRef.current?.navigate('OrderDetails', {
                    orderId: initialNotification.data.orderId,
                  });
                }, 1000); // Small delay to ensure navigation is ready
              }
              // Clear the stored notification
              await AsyncStorage.removeItem('initialNotification');
            }
          } catch (error) {
            console.error('Error handling initial notification:', error);
          }
        };
        
        handleInitialNotification();
      } catch (error) {
        console.error('[Socket] Failed to restore userId:', error);
      }
    };

    restoreUserId();
  }, [userId, setUserId, addOrder]);

  useEffect(() => {
    const newOrderSubscription = OrderSocketEventEmitter.addListener(
      OrderSocketEvents.NEW_ORDER,
      handleNewOrder,
    );

    const orderUpdateSubscription = OrderSocketEventEmitter.addListener(
      OrderSocketEvents.ORDER_UPDATE,
      handleOrderUpdate,
    );

    const walletUpdateSubscription = OrderSocketEventEmitter.addListener(
      'walletUpdated',
      handleWalletUpdate,
    );

    return () => {
      newOrderSubscription.remove();
      orderUpdateSubscription.remove();
      walletUpdateSubscription.remove();
      if (userId) {
        OrderSocket.disconnect().catch(console.error);
      }
    };
  }, [userId, handleNewOrder, handleOrderUpdate, handleWalletUpdate]);

  // Cleanup FCM when component unmounts
  useEffect(() => {
    return () => {
      // If user logs out, unregister FCM token
      if (!userId) {
        FCMService.unregisterToken().catch(console.error);
      }
    };
  }, [userId]);

  return (
    <NavigationContainer ref={navigationRef}>
      <AppNavigator />
      {/* Add NetworkAlert component for internet connectivity monitoring */}
      <NetworkAlert />
      {/* Add NotificationPermission component to handle permission requests */}
      <NotificationPermission />
    </NavigationContainer>
  );
};

export default App;
