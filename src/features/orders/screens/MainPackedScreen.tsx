import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator} from 'react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import OrderCard from '../../../components/order/OrderCard';
import {useStore} from '../../../store/ordersStore';

type OrderPackedScreenProps = StackScreenProps<
  RootStackParamList,
  'MainPackedScreen'
>;

const MainPackedScreen: React.FC<OrderPackedScreenProps> = ({navigation}) => {
  const {orders} = useStore();
  const [activeTab, setActiveTab] = useState<'delivery' | 'pickup'>('delivery');
  const [isLoading, setIsLoading] = useState(true);
  const [isPickupLoading, setIsPickupLoading] = useState(true);

  // Filter orders based on deliveryEnabled instead of deliveryServiceAvailable
  const deliveryOrders = orders.filter(
    o =>
      (o.status === 'packed' || o.status === 'assigned') && o.deliveryEnabled,
  );

  const pickupOrders = orders.filter(
    o => o.status === 'packed' && !o.deliveryEnabled,
  );

  // Add loading effect that simulates loading time
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Short delay for visual feedback
    
    return () => clearTimeout(timer);
  }, []); // Run once when component mounts

  // Add separate loading effect for pickup tab
  useEffect(() => {
    if (activeTab === 'pickup') {
      setIsPickupLoading(true);
      const timer = setTimeout(() => {
        setIsPickupLoading(false);
      }, 800); // Short delay for visual feedback
      
      return () => clearTimeout(timer);
    }
  }, [activeTab]); // Run when tab changes to pickup

  const handleNavigation = (item: any) => {
    if (item.deliveryEnabled) {
      // Send delivery-enabled orders to AssignDeliveryPartner
      navigation.navigate('AssignDeliveryPartner', {order: item});
    } else {
      navigation.navigate('OrderDetail', {order: item, fromPackedTab: true});
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          onPress={() => setActiveTab('delivery')}
          style={[styles.tab, activeTab === 'delivery' && styles.activeTab]}>
          <Text style={styles.tabText}>Delivery Service</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('pickup')}
          style={[styles.tab, activeTab === 'pickup' && styles.activeTab]}>
          <Text style={styles.tabText}>Pickup</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={activeTab === 'delivery' ? deliveryOrders : pickupOrders}
        renderItem={({item}) => (
          <OrderCard
            order={item}
            navigation={navigation}
            onAccept={() => {}}
            onReject={() => {}}
            onCancelItem={() => {}}
            onAssignDeliveryPartner={
              activeTab === 'delivery'
                ? () => {
                    console.log('Navigating with order:', item);
                    handleNavigation(item);
                  }
                : undefined
            }
            onPress={
              activeTab === 'delivery'
                ? () => handleNavigation(item)
                : () => navigation.navigate('OrderHasPacked', {order: item})
            }
          />
        )}
        keyExtractor={item => item._id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No packed orders</Text>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Loading Overlay - Show when initial loading or pickup tab is loading */}
      {(isLoading || (activeTab === 'pickup' && isPickupLoading)) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#340e5c" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f5f5'},
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  list: {padding: 20},
  emptyText: {textAlign: 'center', color: '#555', fontSize: 16, marginTop: 20},
});

export default MainPackedScreen;
