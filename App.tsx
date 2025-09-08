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
import {AdMobProvider} from './src/contexts/AdMobContext';

export const navigationRef = React.createRef<NavigationContainerRef<any>>();

const App = () => {
  const {
    userId,
    setUserId,
    addOrder,
    updateOrder,
    setWalletBalance,
    addWalletTransaction,
    orders,
  } = useStore();

  // Function to navigate to order detail with complete order data
  const navigateToOrderDetail = async (orderId: string) => {
    try {
      // First try to find the order in the store
      let order = orders.find(o => o._id === orderId);
      
      if (!order) {
        // If not found in store, fetch from API
        console.log('Order not found in store, fetching from API:', orderId);
        const api = require('./src/services/api').default;
        const response = await api.get(`/orders/${orderId}`);
        order = response.data;
      }
      
      if (order && navigationRef.current) {
        console.log('Navigating to OrderDetail with complete order data:', order);
        navigationRef.current.navigate('OrderDetail', { order });
      } else {
        console.error('Failed to fetch order data for navigation:', orderId);
      }
    } catch (error) {
      console.error('Error fetching order for navigation:', error);
    }
  };

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
      
      // Clear all notifications when app is opened from notification
      FCMService.clearAllNotifications();
      
      // Handle navigation if needed
      if (navigationRef.current && remoteMessage.data?.orderId && typeof remoteMessage.data.orderId === 'string') {
        // Navigate to order details with proper order data
        navigateToOrderDetail(remoteMessage.data.orderId);
      }
    });
    
    // Check if app was opened from a notification (app in quit state)
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from quit state by notification:', remoteMessage);
        
        // Clear all notifications when app is opened from quit state
        FCMService.clearAllNotifications();
        
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
          setUserId(storedBranchId as string);

          // Re-register FCM token after authentication is confirmed with multiple retries
          const retryFCMRegistration = async (attempt = 1, maxAttempts = 3) => {
            try {
              console.log(`[FCM] Registration attempt ${attempt}/${maxAttempts}`);
              await FCMService.registerTokenAfterAuth();
              console.log(`[FCM] Registration successful on attempt ${attempt}`);
            } catch (error) {
              console.error(`[FCM] Registration failed on attempt ${attempt}:`, error);
              if (attempt < maxAttempts) {
                const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
                console.log(`[FCM] Retrying in ${delay}ms...`);
                setTimeout(() => retryFCMRegistration(attempt + 1, maxAttempts), delay);
              } else {
                console.error('[FCM] All registration attempts failed');
              }
            }
          };

          // Start FCM registration with retries
          setTimeout(() => retryFCMRegistration(), 1000); // Wait 1 second for auth to settle

          // Also retry any pending token registration
          setTimeout(() => {
            FCMService.retryPendingTokenRegistration().catch(error => {
              console.error('Failed to retry pending FCM token registration:', error);
            });
          }, 5000); // Wait 5 seconds for auth to fully settle

          // Set up periodic FCM token registration check (every 30 minutes)
          const fcmCheckInterval = setInterval(() => {
            FCMService.checkTokenRegistrationStatus().catch(error => {
              console.error('Failed to check FCM token registration status:', error);
            });
          }, 30 * 60 * 1000); // 30 minutes

          // Store interval ID for cleanup
          (global as any).fcmCheckInterval = fcmCheckInterval;

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
                  navigateToOrderDetail(initialNotification.data.orderId);
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
      // Clean up FCM check interval
      if ((global as any).fcmCheckInterval) {
        clearInterval((global as any).fcmCheckInterval);
        (global as any).fcmCheckInterval = null;
      }
    };
  }, []);

  // Handle FCM token unregistration only on actual logout
  const prevUserIdRef = React.useRef(userId);
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = userId;
    
    // Only unregister FCM token if user was logged in and now is logged out
    if (prevUserId && !userId) {
      console.log('[FCM] User logged out, unregistering FCM token');
      FCMService.unregisterToken().catch(console.error);
    }
  }, [userId]);

  return (
    <AdMobProvider>
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
        {/* Add NetworkAlert component for internet connectivity monitoring */}
        <NetworkAlert />
        {/* Add NotificationPermission component to handle permission requests */}
        <NotificationPermission />
      </NavigationContainer>
    </AdMobProvider>
  );
};

export default App;
