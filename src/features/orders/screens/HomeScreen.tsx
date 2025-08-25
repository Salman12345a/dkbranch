import React, {useEffect, useCallback, useState, useMemo, useRef} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  StyleSheet,
  Text,
  Alert,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Animated,
  Easing,
} from 'react-native';
import {storage} from '../../../utils/storage';
import {useAdMobContext} from '../../../contexts/AdMobContext';
import AdLoadingOverlay from '../../../components/admob/AdLoadingOverlay';
import Header from '../../../components/dashboard/Header';
import OrderCard from '../../../components/order/OrderCard';
import LowBalanceModal from '../../../components/common/LowBalanceModal';
import {useStore, Order} from '../../../store/ordersStore';
import api from '../../../services/api';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/types';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {jwtDecode} from 'jwt-decode';
import LottieView from 'lottie-react-native';
import Sound from 'react-native-sound';
import {
  OrderSocket,
  OrderSocketEventEmitter,
  OrderSocketEvents,
} from '../../../native/OrderSocket';
import {FloatingOverlay} from '../../../native/FloatingOverlay';
import {BackHandler, Platform, NativeModules} from 'react-native';

type HomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'HomeScreen'
> &
  DrawerNavigationProp<any>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

interface TokenPayload {
  userId?: string;
  branchId?: string;
  exp?: number;
  iat?: number;
}

// Initialize Sound
Sound.setCategory('Playback');
let orderSound: Sound | null = null;
let soundInitialized = false;

// Interface for orders coming from the native module
export interface NativeOrder {
  orderId: string;
  branchId: string;
  orderData: string; // JSON string
  status: string;
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}

const HomeScreen: React.FC<HomeScreenProps> = ({navigation}) => {
  const {
    storeStatus,
    orders,
    setStoreStatus,
    setOrders,
    setUserId,
    walletBalance,
  } = useStore();
  const [userId, setLocalUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);

  // AdMob context
  const { state: adMobState } = useAdMobContext();
  
  // Animation prep overlay state
  const [showPrepOverlay, setShowPrepOverlay] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const adLoadingFadeAnim = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);
  const appState = useRef(AppState.currentState);

  // Initialize order ring sound
  useEffect(() => {
    console.log('Initializing order sound');
    // Ensure we don't have multiple instances
    if (orderSound) {
      orderSound.release();
      orderSound = null;
    }
    
    // Load sound file with retry mechanism
    const loadSound = () => {
      try {
        orderSound = new Sound(
          require('../../../assets/music/OrderRing.mp3'),
          (error: any) => {
            if (error) {
              console.error('Failed to load order sound:', error);
              // Retry after 2 seconds
              setTimeout(loadSound, 2000);
            } else {
              console.log('Order sound loaded successfully');
              // Set volume
              orderSound?.setVolume(1.0);
              soundInitialized = true;
              
              // Prime the sound by playing it silently (volume 0)
              if (orderSound) {
                const originalVolume = orderSound.getVolume();
                orderSound.setVolume(0);
                orderSound.play(() => {
                  orderSound?.stop();
                  orderSound?.setVolume(originalVolume);
                  console.log('Order sound primed successfully');
                });
              }
            }
          },
        );
      } catch (err) {
        console.error('Exception during sound initialization:', err);
        // Retry after 2 seconds
        setTimeout(loadSound, 2000);
      }
    };
    
    loadSound();

    // Clean up on unmount
    return () => {
      if (orderSound) {
        orderSound.release();
        orderSound = null;
        soundInitialized = false;
      }
    };
  }, []);

  useEffect(() => {
    // Function to fetch persisted orders and update store
    const fetchPersistedOrdersAndUpdateStore = async () => {
      console.log('[HomeScreen] Attempting to fetch persisted orders.');
      if (storeStatus !== 'open') {
        console.log('[HomeScreen] Store is not open, skipping fetch persisted orders.');
        return;
      }
      try {
        const nativeOrders: NativeOrder[] = await OrderSocket.getPersistedOrders();
        console.log(`[HomeScreen] Fetched ${nativeOrders.length} persisted orders.`);

        if (nativeOrders && nativeOrders.length > 0) {
          const transformedOrders: Order[] = nativeOrders.map(nativeOrder => {
            let parsedOrderData: any = {};
            try {
              parsedOrderData = JSON.parse(nativeOrder.orderData);
            } catch (e) {
              console.error('Failed to parse orderData for orderId:', nativeOrder.orderId, e);
            }
            return {
              _id: nativeOrder.orderId, // Use native orderId as store's _id
              orderId: nativeOrder.orderId,
              items: parsedOrderData.items || [], // Extract items from parsed orderData
              status: nativeOrder.status,
              createdAt: new Date(nativeOrder.createdAt).toISOString(),
              // Add other fields from your store's Order type if needed
              // e.g., branchId: nativeOrder.branchId,
              // updatedAt: new Date(nativeOrder.updatedAt).toISOString(),
            };
          });

          setOrders(prevOrders => {
            const ordersMap = new Map(prevOrders.map(o => [o._id, o]));
            transformedOrders.forEach(fetchedOrder => {
              // If order exists, update it. Otherwise, add it.
              // Consider more sophisticated merging if needed (e.g., based on updatedAt)
              ordersMap.set(fetchedOrder._id, fetchedOrder);
            });
            const mergedOrders = Array.from(ordersMap.values());
            console.log(`[HomeScreen] Merged orders. Total in store: ${mergedOrders.length}`);
            return mergedOrders;
          });
        }
      } catch (error) {
        console.error('[HomeScreen] Failed to fetch or process persisted orders:', error);
      }
    };

    // Initial fetch and AppState listener setup
    if (storeStatus === 'open') {
      fetchPersistedOrdersAndUpdateStore();
    }

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        (appState.current === 'inactive' || appState.current === 'background') &&
        nextAppState === 'active'
      ) {
        console.log('[HomeScreen] App has come to the foreground!');
        if (storeStatus === 'open') {
          fetchPersistedOrdersAndUpdateStore();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [storeStatus, setOrders, appState]);

  // Function to play order sound with retry mechanism
  const playOrderSound = useCallback(() => {
    console.log('Attempting to play order sound, initialized:', soundInitialized);
    
    if (!soundInitialized) {
      console.log('Sound not initialized yet, attempting to initialize...');
      // Try to re-initialize sound if not already initialized
      if (!orderSound) {
        try {
          orderSound = new Sound(
            require('../../../assets/music/OrderRing.mp3'),
            (error: any) => {
              if (error) {
                console.error('Failed to load order sound in playback attempt:', error);
              } else {
                console.log('Order sound loaded in playback attempt');
                soundInitialized = true;
                orderSound?.setVolume(1.0);
                // Play after initialization
                orderSound?.stop();
                orderSound?.play((success: boolean) => {
                  if (!success) {
                    console.error('Sound playback failed after initialization');
                  } else {
                    console.log('Sound played successfully after initialization');
                  }
                });
              }
            },
          );
        } catch (err) {
          console.error('Exception during sound playback initialization:', err);
        }
      }
      return;
    }
    
    if (orderSound) {
      try {
        // Reset sound to beginning (in case it was played before)
        orderSound.stop();
        // Play the sound with max volume to ensure audibility
        orderSound.setVolume(1.0);
        orderSound.play((success: boolean) => {
          if (!success) {
            console.error('Sound playback failed, attempting to retry...');
            // Try again after a short delay
            setTimeout(() => {
              orderSound?.stop();
              orderSound?.play();
            }, 300);
          } else {
            console.log('Order sound played successfully');
          }
        });
      } catch (err) {
        console.error('Exception during sound playback:', err);
      }
    } else {
      console.error('Order sound object is null when attempting to play');
    }
  }, []);

  // Add a function to sort orders by ID in FIFO order
  const sortOrdersByFIFO = useCallback((ordersToSort: Order[]) => {
    try {
      return [...ordersToSort].sort((a, b) => {
        // Sort by creation timestamp first
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return aTime - bTime; // Ascending order (FIFO)
      });
    } catch (error) {
      console.error('Error sorting orders:', error);
      return ordersToSort; // Return unsorted array if sorting fails
    }
  }, []);

  // Update the setOrders call to handle duplicates
  const setOrdersWithDuplicateCheck = useCallback(
    (newOrders: Order[]) => {
      setOrders((prevOrders: Order[]) => {
        const uniqueNewOrders = newOrders.filter(
          (order, index, self) =>
            index === self.findIndex(o => o._id === order._id),
        );

        if (uniqueNewOrders.length < newOrders.length) {
          console.log(
            'Removed',
            newOrders.length - uniqueNewOrders.length,
            'internal duplicate orders',
          );
        }

        if (prevOrders.length === 0) {
          console.log('Initial load of', uniqueNewOrders.length, 'orders');
          return uniqueNewOrders;
        } else {
          const currentOrderIds = new Set(prevOrders.map(o => o._id));
          const updatedOrders = [...prevOrders];

          let newOrdersAdded = 0;

          uniqueNewOrders.forEach(order => {
            if (!currentOrderIds.has(order._id)) {
              updatedOrders.push(order);
              newOrdersAdded++;
              console.log(
                'Adding order via setOrders:',
                order._id,
                'orderId:',
                order.orderId,
              );
            }
          });

          if (newOrdersAdded > 0) {
            console.log('Added', newOrdersAdded, 'new orders from API');
            // Play order sound when new orders are detected via API
            playOrderSound();
          }

          return updatedOrders;
        }
      });
    },
    [setOrders, playOrderSound],
  );

  // Update the fetchOrders function to use the new setOrders function
  const fetchOrders = useCallback(
    async (branchId: string) => {
      // Track initial order count to detect if new orders are added
      const initialOrderCount = orders.length;
      let newOrdersDetected = false;
      try {
        console.log('Fetching orders for branchId:', branchId);

        const token = storage.getString('accessToken');
        if (!token) {
          console.error(
            'No token available for order fetch - redirecting to login',
          );
          navigation.reset({
            index: 0,
            routes: [{name: 'Authentication'}],
          });
          return;
        }

        console.log('Using token for fetch:', token.substring(0, 10) + '...');

        const isApproved = storage.getBoolean('isApproved');
        if (!isApproved) {
          console.error('Branch not approved - redirecting to StatusScreen');
          navigation.reset({
            index: 0,
            routes: [{name: 'StatusScreen', params: {branchId}}],
          });
          return;
        }

        const response = await api.get('/orders/', {
          params: {branchId},
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response?.data) {
          console.error('No data received from orders API');
          return;
        }

        console.log(
          'Orders fetched successfully:',
          response.data?.length || 0,
          'orders',
        );

        // Validate and clean the orders data
        const validOrders = response.data.filter((order: any) => {
          // Check for minimum required fields
          if (!order?._id) {
            console.warn('Order missing _id:', order);
            return false;
          }

          // Check if order has items
          if (!Array.isArray(order?.items)) {
            console.warn('Order has no items array:', order._id);
            return false;
          }

          // Check if order has required timestamps
          if (!order?.createdAt) {
            console.warn('Order missing createdAt:', order._id);
            return false;
          }

          return true;
        });

        // Sort orders before setting them
        const sortedOrders = sortOrdersByFIFO(validOrders);
        console.log(
          'Setting sorted orders:',
          sortedOrders.map(o => ({
            id: o._id,
            created: o.createdAt,
            status: o.status,
          })),
        );

        // Update to use the new setOrders function
        setOrdersWithDuplicateCheck(sortedOrders);
        
        // Explicitly check if new orders were added and play sound
        // This is a backup in case the setOrdersWithDuplicateCheck doesn't trigger
        if (sortedOrders.length > initialOrderCount) {
          newOrdersDetected = true;
          console.log(
            'fetchOrders detected',
            sortedOrders.length - initialOrderCount,
            'new orders, will play sound',
          );
          // Use setTimeout to ensure this runs after state updates
          setTimeout(playOrderSound, 300);
        }
      } catch (error: any) {
        console.error(
          'Fetch Orders Error:',
          error?.response?.status,
          error?.response?.data || error?.message || error,
        );

        if (error?.response?.status === 401) {
          console.log('Unauthorized during order fetch - redirecting to login');
          storage.delete('accessToken');
          storage.delete('userId');
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please login again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{name: 'Authentication'}],
                  });
                },
              },
            ],
          );
          return;
        }

        Alert.alert('Error', 'Failed to load orders. Please try again.');
      }
    },
    [navigation, setOrdersWithDuplicateCheck, orders.length, playOrderSound],
  );

  // Add a refresh function
  const refreshOrders = useCallback(() => {
    if (userId) {
      fetchOrders(userId);
    }
  }, [userId, fetchOrders]);

  // Function to fetch branch data and ensure owner name is stored
  const fetchBranchData = useCallback(async (branchId: string) => {
    try {
      console.log('Fetching branch data for branchId:', branchId);
      const response = await api.get(`/branch/status/${branchId}`);

      if (response.data) {
        // Store important branch information in local storage
        if (response.data.name) {
          storage.set('branchName', response.data.name);
        }

        if (response.data.ownerName) {
          storage.set('ownerName', response.data.ownerName);
        }

        console.log(
          'Branch data fetched successfully and stored in local storage',
        );
      }
    } catch (error: any) {
      console.error(
        'Error fetching branch data:',
        error?.response?.data || error?.message,
      );
      // Non-critical error, don't show alert to user
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const storedUserId = storage.getString('userId');
        const storedBranchId = storage.getString('branchId');
        const storedAccessToken = storage.getString('accessToken');
        const isApproved = storage.getBoolean('isApproved') || false;

        console.log(
          'HomeScreen mounted with userId:',
          storedUserId,
          'branchId:',
          storedBranchId,
          'accessToken:',
          storedAccessToken ? 'present' : 'missing',
          'isApproved:',
          isApproved,
        );

        // If both IDs exist but don't match, prioritize branchId (source of truth)
    if (storedBranchId && storedUserId && storedBranchId !== storedUserId) {
      console.warn('Mismatch between branchId and userId detected. Using branchId as userId');
      storage.set('userId', storedBranchId);
      setUserId(storedBranchId);
    }

    if (storedBranchId && !storedUserId) {
          console.log('Setting userId from branchId for consistency');
          storage.set('userId', storedBranchId);
          setUserId(storedBranchId);
        }

        if (!storedAccessToken) {
          console.error('No accessToken available - redirecting to login');
          navigation.reset({
            index: 0,
            routes: [{name: 'Authentication'}],
          });
          return;
        }

        if (!isApproved) {
          const idToUse = storedUserId || storedBranchId;
          if (idToUse) {
            console.error('Branch not approved - redirecting to StatusScreen');
            navigation.reset({
              index: 0,
              routes: [{name: 'StatusScreen', params: {branchId: idToUse}}],
            });
            return;
          } else {
            navigation.reset({
              index: 0,
              routes: [{name: 'Authentication'}],
            });
            return;
          }
        }

        let finalUserId = storedUserId || storedBranchId;
        if (storedAccessToken) {
          try {
            const tokenPayload = jwtDecode<TokenPayload>(storedAccessToken);
            console.log('Token Payload:', tokenPayload);

            const tokenId = tokenPayload.userId || tokenPayload.branchId || '';

            if (!tokenId) {
              console.error(
                'No userId or branchId in token - redirecting to login',
              );
              storage.delete('userId');
              storage.delete('accessToken');
              navigation.reset({
                index: 0,
                routes: [{name: 'Authentication'}],
              });
              return;
            }

            // Decide which ID to trust for downstream API calls.
            // If we already have a branchId in storage, always prefer that as it is
            // the correct identifier for branch-scoped endpoints, regardless of what
            // the JWT token contains.
            if (storedBranchId) {
              // Keep branchId as source-of-truth. Do not overwrite with tokenId.
              finalUserId = storedBranchId;
              if (storedUserId !== storedBranchId) {
                console.warn('Keeping branchId as userId, ignoring token userId');
                storage.set('userId', storedBranchId);
              }
            } else if (storedUserId) {
              // Fall back to existing userId if no branchId present.
              finalUserId = storedUserId;
            } else {
              // As a last resort, use the ID found in the token.
              finalUserId = tokenId;
              storage.set('userId', finalUserId);
              console.log('Set userId from token payload:', finalUserId);
            }

            if (finalUserId) {
              // Initial fetch and state setup
              if (isMounted) {
                fetchOrders(finalUserId);
                setLocalUserId(finalUserId);
                setAccessToken(storedAccessToken);
                setUserId(finalUserId);

                // Fetch branch data to ensure owner name is available
                fetchBranchData(finalUserId);
              }
            }
          } catch (error) {
            console.error('Token processing error:', error);
            storage.delete('userId');
            storage.delete('accessToken');
            navigation.reset({
              index: 0,
              routes: [{name: 'Authentication'}],
            });
            return;
          }
        } else {
          console.error('No finalUserId available after token processing');
          navigation.reset({
            index: 0,
            routes: [{name: 'Authentication'}],
          });
        }
      } catch (error) {
        console.error('Auth check error:', error);
        navigation.reset({
          index: 0,
          routes: [{name: 'Authentication'}],
        });
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [navigation, fetchOrders, setUserId]);

  // Separate useEffect for socket listeners
  useEffect(() => {
    if (!userId) return;

    const handleNewOrder = (orderData: any) => {
      try {
        console.log('[Socket] Processing new order:', orderData);
        const order =
          typeof orderData.orderData === 'string'
            ? JSON.parse(orderData.orderData)
            : orderData.orderData;

        // Ensure we have the required fields
        if (!order?._id || !Array.isArray(order?.items) || !order?.createdAt) {
          console.warn('[Socket] Invalid order data received:', order);
          return;
        }

        // Use functional update to ensure we're working with latest state
        setOrders((prevOrders: Order[]) => {
          // Check if order already exists
          const exists = prevOrders.some(o => o._id === order._id);
          if (exists) {
            console.log('[Socket] Order already exists:', order._id);
            return prevOrders;
          }

          // Play order sound when a new order is received
          playOrderSound();

          const newOrders = sortOrdersByFIFO([order, ...prevOrders]);
          console.log('[Socket] Added new order:', order._id);
          return newOrders;
        });
      } catch (error) {
        console.error('[Socket] Error handling new order:', error);
      }
    };

    const handleOrderUpdate = (data: any) => {
      try {
        console.log('[Socket] Processing order update:', data);
        const updatedOrder =
          typeof data.orderData === 'string'
            ? JSON.parse(data.orderData)
            : data.orderData;

        setOrders((prevOrders: Order[]) => {
          const updatedOrders = prevOrders.map((order: Order) =>
            order._id === data.orderId ? {...order, ...updatedOrder} : order,
          );
          const sortedOrders = sortOrdersByFIFO(updatedOrders);
          console.log('[Socket] Updated order:', data.orderId);
          return sortedOrders;
        });
      } catch (error) {
        console.error('[Socket] Error handling order update:', error);
      }
    };

    // Set up socket listeners
    const newOrderSubscription = OrderSocketEventEmitter.addListener(
      OrderSocketEvents.NEW_ORDER,
      handleNewOrder,
    );

    const orderUpdateSubscription = OrderSocketEventEmitter.addListener(
      OrderSocketEvents.ORDER_UPDATE,
      handleOrderUpdate,
    );

    // Set up fallback refresh every 1 minute
    const refreshInterval = setInterval(() => {
      console.log('[Fallback] Checking for new orders...');
      // Store current order count to compare after fetching
      const currentOrderCount = orders.length;
      fetchOrders(userId).then(() => {
        // Check if new orders were detected during this refresh
        if (orders.length > currentOrderCount) {
          console.log('[Fallback] New orders detected, playing sound');
          // Force sound to play for new orders detected via fallback
          setTimeout(playOrderSound, 500); // Slight delay to ensure state is updated
        }
      });
    }, 60 * 1000); // 1 minute

    return () => {
      newOrderSubscription.remove();
      orderUpdateSubscription.remove();
      clearInterval(refreshInterval);
      console.log('[Socket] Cleaned up socket listeners and refresh interval');
    };
  }, [userId, sortOrdersByFIFO, fetchOrders]);

  // Memoize the filtered and sorted orders to prevent unnecessary re-renders
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter(
      o =>
        o.status !== 'delivered' &&
        o.status !== 'cancelled' &&
        o.status !== 'packed' &&
        o.status !== 'assigned',
    );
    return sortOrdersByFIFO(filtered);
  }, [orders, sortOrdersByFIFO]);

  // Add pull-to-refresh functionality for manual updates
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (userId) {
        await fetchOrders(userId);
      }
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [userId, fetchOrders]);

  const handleAccept = useCallback(
    async (orderId: string) => {
      try {
        await api.patch(`/orders/${orderId}/accept`, null);
        setOrders(
          orders.map(order =>
            order._id === orderId ? {...order, status: 'accepted'} : order,
          ),
        );
      } catch (error) {
        console.error('Accept Order Error:', error);
        Alert.alert('Error', 'Failed to accept order');
      }
    },
    [orders, setOrders],
  );

  const handleReject = useCallback(
    async (orderId: string) => {
      try {
        await api.patch(`/orders/${orderId}/cancel`, null);
        setOrders(
          orders.map(order =>
            order._id === orderId ? {...order, status: 'cancelled'} : order,
          ),
        );
      } catch (error) {
        console.error('Reject Order Error:', error);
        Alert.alert('Error', 'Failed to reject order');
      }
    },
    [orders, setOrders],
  );

  const handleCancelItem = useCallback(
    async (orderId: string, itemId: string) => {
      try {
        await api.patch(`/orders/${orderId}/cancel-item/${itemId}`, null);
        setOrders(
          orders.map(order =>
            order._id === orderId
              ? {
                  ...order,
                  items: order.items.filter(item => item._id !== itemId),
                }
              : order,
          ),
        );
      } catch (error) {
        console.error('Cancel Item Error:', error);
        Alert.alert('Error', 'Failed to cancel item');
      }
    },
    [orders, setOrders],
  );

  const handleAssignDeliveryPartner = useCallback(
    (order: any) => {
      navigation.navigate('AssignDeliveryPartner', {order});
    },
    [navigation],
  );

  const navigateToSalesSummary = useCallback(() => {
    setIsRefreshing(true);
    // Simulate a refresh process before navigation
    setTimeout(() => {
      setIsRefreshing(false);
      navigation.navigate('SalesSummary');
    }, 800);
  }, [navigation]);

  // Add a function to handle recharge navigation
  const handleRecharge = useCallback(() => {
    setShowLowBalanceModal(false);
    navigation.navigate('Wallet');
  }, [navigation]);

  // Check wallet balance and show modal if needed
  useEffect(() => {
    if (walletBalance < -100 && storeStatus === 'closed') {
      setShowLowBalanceModal(true);
    }
  }, [walletBalance, storeStatus]);
  
  // Handle preparation overlay animation and fade out
  useEffect(() => {
    // If not loading anymore, fade out the overlay
    if (!isLoading && showPrepOverlay) {
      console.log('Data loaded, starting fade out animation');
      // Give components some time to render
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }).start(() => {
          setShowPrepOverlay(false);
        });
      }, 1000); // Wait 1 second after loading before starting fade out
    }
  }, [isLoading, fadeAnim, showPrepOverlay]);
  
  // Track screen focus state to handle back button correctly
  const isFocusedRef = useRef(false);
  const hasJustNavigatedRef = useRef(false);

  // Handle back button press using useFocusEffect to properly handle screen focus changes
  useFocusEffect(
    useCallback(() => {
      console.log('HomeScreen gained focus');
      isFocusedRef.current = true;
      
      // Set a flag to indicate we've just navigated to this screen
      // This prevents the back handler from triggering immediately after navigation
      hasJustNavigatedRef.current = true;
      const navigationTimer = setTimeout(() => {
        hasJustNavigatedRef.current = false;
      }, 500); // 500ms delay before enabling back handler after navigation

      // Create the back button handler function
      const handleBackPress = () => {
        // Skip back press handling if we just navigated to this screen
        if (hasJustNavigatedRef.current) {
          console.log('Ignoring back press - just navigated to HomeScreen');
          return false;
        }

        // Only handle back press when on the main screen with store open
        const canShowOverlay = storeStatus === 'open';
        const activeOrderCount = filteredOrders.length;
        
        console.log(
          'Back button pressed, store status:',
          storeStatus,
          'order count:',
          activeOrderCount,
          'screen focused:',
          isFocusedRef.current
        );
        
        if (canShowOverlay && isFocusedRef.current) {
          console.log('Showing overlay due to back button press');
          // Show the overlay
          FloatingOverlay.showOverlay(true, activeOrderCount);
          
          // Use available native methods to minimize app instead of closing it
          if (Platform.OS === 'android') {
            try {
              // Check if we have access to a custom native module for minimizing
              if (NativeModules.AppModule && NativeModules.AppModule.minimizeApp) {
                // Use our custom module if available
                NativeModules.AppModule.minimizeApp();
              } else if (NativeModules.ReactNativeAndroidBackgroundActivity && 
                        NativeModules.ReactNativeAndroidBackgroundActivity.moveTaskToBack) {
                // Some React Native configurations have this method available
                NativeModules.ReactNativeAndroidBackgroundActivity.moveTaskToBack(true);
              } else {
                // Fallback - this simulates a HOME button press
                console.log('Using BackHandler.exitApp() as fallback for minimizing');
                // Note: this doesn't actually exit the app, just minimizes it on most Android devices
                setTimeout(() => BackHandler.exitApp(), 100);
              }
            } catch (err) {
              console.error('Failed to minimize app:', err);
            }
          }
          
          // Return true to indicate we've handled the back press
          return true;
        }
        
        // Return false to allow default back behavior for navigation
        return false;
      };

      // Add the back button handler
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

      // Clean up when screen loses focus
      return () => {
        console.log('HomeScreen lost focus');
        isFocusedRef.current = false;
        clearTimeout(navigationTimer);
        backHandler.remove();
      };
    }, [storeStatus, filteredOrders.length])
  );

  // Request overlay permission when component mounts
  useEffect(() => {
    FloatingOverlay.requestOverlayPermission().catch(error => {
      console.error('Failed to request overlay permission:', error);
    });
  }, []);

  // Set up app state change listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background') {
        const activeOrderCount = filteredOrders.length;
        if (storeStatus === 'open') {
          console.log(
            'App went to background with store open, showing floating overlay',
          );
          FloatingOverlay.showOverlay(true, activeOrderCount);
        } else {
          // Always hide overlay when store is closed, regardless of order count
          console.log(
            'App went to background with store closed, hiding floating overlay',
          );
          FloatingOverlay.hideOverlay();
        }
      } else if (nextAppState === 'active') {
        // Hide overlay when app comes to foreground
        console.log('App came to foreground, hiding floating overlay');
        FloatingOverlay.hideOverlay();
      }
    });

    // Clean up on unmount
    return () => {
      subscription.remove();
      // Note: We don't need to remove backHandler here as it's handled by useFocusEffect
      FloatingOverlay.hideOverlay();
      console.log('HomeScreen unmounted, cleanup complete');
    };
  }, [storeStatus, filteredOrders.length]);

  // Add another useEffect to update the overlay when orders change (ONLY when store is open)
  useEffect(() => {
    if (appState.current === 'background') {
      const activeOrderCount = filteredOrders.length;
      if (storeStatus === 'open') {
        console.log('Updating overlay with new order count:', activeOrderCount);
        FloatingOverlay.updateOverlay(true, activeOrderCount);
      }
    }
  }, [filteredOrders.length, appState, storeStatus]);

  // Add dedicated useEffect to handle store status changes
  useEffect(() => {
    // Only handle status changes when app is in background
    if (appState.current === 'background') {
      const activeOrderCount = filteredOrders.length;
      
      if (storeStatus === 'open') {
        // Show overlay immediately when store status changes to open
        console.log('Store status changed to open while in background, showing overlay');
        FloatingOverlay.showOverlay(true, activeOrderCount);
      } else {
        // Hide overlay immediately when store status changes to closed
        console.log('Store status changed to closed while in background, hiding overlay');
        FloatingOverlay.hideOverlay();
      }
    }
  }, [storeStatus, appState, filteredOrders.length]);

  // Handle AdMob loading overlay
  useEffect(() => {
    if (adMobState.isLoadingAd) {
      // Show ad loading overlay
      Animated.timing(adLoadingFadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      // Hide ad loading overlay
      Animated.timing(adLoadingFadeAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [adMobState.isLoadingAd, adLoadingFadeAnim]);

  // Show only authentication loading internally, but keep the prep overlay visible
  // This allows components to load in the background while animation is showing

  if (!userId || !accessToken) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Preparation animation overlay */}
      {showPrepOverlay && (
        <Animated.View style={[styles.prepOverlay, { opacity: fadeAnim }]}>
          <View style={styles.prepContainer}>
            <LottieView
              ref={lottieRef}
              source={require('../../../assets/animations/prepare.json')}
              autoPlay
              loop
              style={styles.prepAnimation}
            />
          </View>
        </Animated.View>
      )}
      
      {/* AdMob loading overlay */}
      <AdLoadingOverlay 
        visible={adMobState.isLoadingAd} 
        opacity={adLoadingFadeAnim} 
      />
      
      <Header
        navigation={navigation}
        showStoreStatus
        setShowLowBalanceModal={setShowLowBalanceModal}
      />
      {storeStatus === 'closed' ? (
        <View style={styles.closedContainer}>
          <LottieView
            source={require('../../../assets/animations/Closed.json')}
            autoPlay
            loop
            style={styles.closedAnimation}
          />
          <Text style={styles.closedText}>Store is currently closed</Text>
          <Text style={styles.closedSubtext}>
            Open your store to receive new orders
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Check Today's Sales</Text>
            <TouchableOpacity
              style={styles.viewButton}
              disabled={isRefreshing}
              onPress={navigateToSalesSummary}>
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.viewButtonText}>View</Text>
              )}
            </TouchableOpacity>
          </View>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyOrdersContainer}>
              <LottieView
                source={require('../../../assets/animations/open.json')}
                autoPlay
                loop
                style={styles.openAnimation}
              />

              <Text style={styles.noOrdersSubtext}>
                Your store is open and ready to receive orders
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              renderItem={({item}) => (
                <OrderCard
                  order={item}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  onCancelItem={handleCancelItem}
                  onAssignDeliveryPartner={() =>
                    handleAssignDeliveryPartner(item)
                  }
                  navigation={navigation}
                  onPress={() =>
                    navigation.navigate('OrderDetail', {order: item})
                  }
                />
              )}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.orderList}
              onRefresh={handleRefresh}
              refreshing={isRefreshing}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}
      <TouchableOpacity
        onPress={() => navigation.navigate('MainPackedScreen')}
        style={styles.packedOrderButton}>
        <Text style={styles.packedOrderButtonText}>Packed Order</Text>
      </TouchableOpacity>

      <LowBalanceModal
        visible={showLowBalanceModal}
        onRecharge={handleRecharge}
        onCancel={() => setShowLowBalanceModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f8f8f8'},
  content: {padding: 20, flex: 1},
  prepOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prepContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  prepAnimation: {
    width: 160,
    height: 160,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {fontSize: 20, color: '#333'},
  viewButton: {
    backgroundColor: '#28a745',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 4,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderList: {paddingBottom: 20},
  emptyOrdersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  openAnimation: {
    width: 200,
    height: 200,
  },
  noOrdersText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  noOrdersSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  orderTitle: {fontWeight: 'bold', fontSize: 16},
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#28a745',
    color: '#fff',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#007bff',
    marginRight: 10,
  },
  buttonText: {color: '#fff'},
  packedOrderButton: {
    backgroundColor: '#28a745',
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  packedOrderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closedAnimation: {
    width: 200,
    height: 200,
  },
  closedText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  closedSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default HomeScreen;
