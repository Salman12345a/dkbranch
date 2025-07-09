import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {useStore} from '../../../store/ordersStore';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {useIsFocused} from '@react-navigation/native';

type OrderHistoryProps = StackScreenProps<RootStackParamList, 'OrderHistory'>;

const OrderHistory: React.FC<OrderHistoryProps> = ({navigation}) => {
  const [activeTab, setActiveTab] = useState<'delivery' | 'pickup'>('delivery');
  const {orders} = useStore();
  const isFocused = useIsFocused();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('OrderHistory focused');
    });
    return unsubscribe;
  }, [navigation]);

  if (!isFocused || !orders) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  // Updated filters for Delivery and Pickup tabs
  const filteredOrders =
    activeTab === 'delivery'
      ? orders.filter(
          order => order.status === 'delivered' && order.deliveryEnabled,
        )
      : orders.filter(
          order => order.status === 'delivered' && !order.deliveryEnabled,
        );

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'delivery' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('delivery')}>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'delivery' && styles.activeTabLabel,
            ]}>
            Delivery Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'pickup' && styles.activeTabButton,
          ]}
          onPress={() => setActiveTab('pickup')}>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'pickup' && styles.activeTabLabel,
            ]}>
            Pickup
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredOrders}
        keyExtractor={item => item._id}
        renderItem={({item}) => (
          <View style={styles.orderCard}>
            <Text style={styles.orderId}>Order #{item.orderId}</Text>
            <Text style={styles.orderDetail}>
              Total: ₹{item.totalPrice} | Items: {item.items.length}
            </Text>
            <Text style={styles.orderStatus}>Status: {item.status}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {activeTab === 'delivery'
              ? 'No delivered orders yet'
              : 'No completed pickup orders yet'}
          </Text>
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
  },
  activeTabLabel: {
    color: '#007AFF',
  },
  listContainer: {
    padding: 10,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDetail: {
    fontSize: 14,
    color: '#555',
    marginVertical: 5,
  },
  orderStatus: {
    fontSize: 14,
    color: '#007AFF',
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default OrderHistory;
