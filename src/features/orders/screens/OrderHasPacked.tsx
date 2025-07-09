import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {useStore, Order} from '../../../store/ordersStore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../services/api';

type OrderHasPackedProps = StackScreenProps<
  RootStackParamList,
  'OrderHasPacked'
>;

// Extended Order type with deliveryEnabled property which exists at runtime
interface ExtendedOrder extends Order {
  deliveryEnabled?: boolean;
  deliveryServiceAvailable?: boolean;
  manuallyCollected?: boolean;
}

// Helper function to calculate platform charges based on order value
const calculatePlatformCharge = (orderValue: number): number => {
  // ₹1 for every ₹1000 of order value, rounded up
  return Math.ceil(orderValue / 1000);
};

const OrderHasPacked: React.FC<OrderHasPackedProps> = ({route, navigation}) => {
  const {order: initialOrder} = route.params;
  const {updateOrder, addWalletTransaction} = useStore();
  const [orderState, setOrderState] = useState(initialOrder as ExtendedOrder);

  // Fetch latest order data on mount to ensure item details are present
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await api.get(`/orders/${initialOrder._id}`);
        console.log(
          'Fetched Order Data:',
          JSON.stringify(response.data, null, 2),
        );
        setOrderState(response.data as ExtendedOrder);
        updateOrder(initialOrder._id, response.data);
      } catch (error) {
        console.error('Fetch Order Error:', error);
      }
    };
    fetchOrderDetails();
  }, [initialOrder._id, updateOrder]);

  // Calculate platform charges and final amounts
  const orderCalculations = useMemo(() => {
    const orderTotal = orderState.totalPrice || 0;
    // Check if it's a pickup order (deliveryEnabled is false)
    // For non-pickup orders (delivery enabled), no platform charges
    const isPickupOrder = orderState.deliveryEnabled === false;
    const customerPlatformCharge = isPickupOrder
      ? calculatePlatformCharge(orderTotal)
      : 0;
    const branchPlatformCharge = isPickupOrder
      ? calculatePlatformCharge(orderTotal)
      : 0;

    return {
      orderTotal,
      customerPlatformCharge,
      finalCustomerTotal: orderTotal + customerPlatformCharge,
      branchPlatformCharge,
      branchReceives: orderTotal - branchPlatformCharge,
      isPickupOrder,
    };
  }, [orderState.totalPrice, orderState.deliveryEnabled]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Icon name="check-circle" size={32} color="#2ecc71" />
        <Text style={styles.title}>Order Ready for Pickup</Text>
        <Text style={styles.orderId}>#{orderState.orderId}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        <FlatList
          data={orderState.items}
          renderItem={({item}) => (
            <View style={styles.item}>
              <Icon
                name="inventory"
                size={20}
                color="#3498db"
                style={styles.itemIcon}
              />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>
                  {item.item.name || 'Unknown Item'}
                </Text>
                <Text style={styles.itemMeta}>
                  {item.count} x ₹{(item.item.price || 0).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                ₹{((item.item.price || 0) * item.count).toFixed(2)}
              </Text>
            </View>
          )}
          keyExtractor={item => item._id}
          scrollEnabled={false}
        />
      </View>

      <View style={styles.summaryCard}>
        {orderCalculations.isPickupOrder ? (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order Total</Text>
              <Text style={styles.summaryValue}>
                ₹{orderCalculations.orderTotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Customer Platform Fee</Text>
              <Text style={styles.summaryValue}>
                +₹{orderCalculations.customerPlatformCharge.toFixed(2)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Customer Pays</Text>
              <Text style={styles.finalTotal}>
                ₹{orderCalculations.finalCustomerTotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Branch Platform Fee</Text>
              <Text style={styles.summaryValue}>
                -₹{orderCalculations.branchPlatformCharge.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelBold}>Branch Receives</Text>
              <Text style={styles.branchTotal}>
                ₹{orderCalculations.branchReceives.toFixed(2)}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.total}>Total: ₹{orderState.totalPrice || 0}</Text>
        )}

        {orderState.modificationHistory &&
          orderState.modificationHistory.length > 0 && (
            <View style={styles.changes}>
              <Text style={styles.changesTitle}>Modification History:</Text>
              {orderState.modificationHistory[0]?.changes?.map(
                (change, index) => (
                  <View key={index} style={styles.changeItem}>
                    <Icon name="edit" size={14} color="#95a5a6" />
                    <Text style={styles.changeText}>{change}</Text>
                  </View>
                ),
              )}
            </View>
          )}
      </View>

      <View style={styles.notice}>
        <Icon name="info" size={24} color="#3498db" />
        <Text style={styles.message}>
          Informed Customer! To visit the Branch to collect their items.
        </Text>
      </View>

      {/* Completed button - only show when manuallyCollected is true */}
      {orderState.manuallyCollected && (
        <TouchableOpacity
          style={styles.completedButton}
          onPress={() => navigation.goBack()}>
          <Icon
            name="check"
            size={24}
            color="#FFFFFF"
            style={styles.buttonIcon}
          />
          <Text style={styles.completedButtonText}>Completed</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#ffff',
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 10,
  },
  orderId: {
    fontSize: 16,
    color: '#7f8c8d',
    marginTop: 5,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f6fa',
  },
  itemIcon: {
    marginRight: 15,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2ecc71',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#2c3e50',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryValue: {
    fontSize: 16,
    color: '#2c3e50',
  },
  finalTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  branchTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3498db',
  },
  divider: {
    height: 1,
    backgroundColor: '#ecf0f1',
    marginVertical: 10,
  },
  total: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'right',
    marginBottom: 15,
  },
  changes: {
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  changesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e67e22',
    marginBottom: 10,
  },
  changeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  changeText: {
    fontSize: 14,
    color: '#95a5a6',
    marginLeft: 8,
    flex: 1,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: '#3498db',
    marginLeft: 15,
    flex: 1,
  },
  collectCashButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  collectCashButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completedButton: {
    backgroundColor: '#5E60CE',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  completedButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default OrderHasPacked;
