import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
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
  customerName?: string;
  customerPhone?: string;
  totalPrice?: number;
  customer?: {
    name?: string;
    phone?: string;
  };
  payLater?: {
    requested: boolean;
    status: 'pending' | 'approved' | 'rejected';
    partialPaid: number;
  };
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
  const [payLaterLoading, setPayLaterLoading] = useState(false);
  const [payLaterStatus, setPayLaterStatus] = useState<'approved' | 'rejected' | null>(null);

  // Fetch latest order data on mount to ensure item details are present
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await api.get(`/orders/${initialOrder._id}`);
        console.log(
          'Fetched Order Data:',
          JSON.stringify(response.data, null, 2),
        );
        console.log('Customer Name:', response.data.customerName);
        console.log('Customer Phone:', response.data.customerPhone);
        console.log('Customer Info:', response.data.customer);
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

    return {
      orderTotal,
      customerPlatformCharge,
      finalCustomerTotal: orderTotal + customerPlatformCharge,
      branchPlatformCharge: 0, // No platform charge for the branch
      branchReceives: orderTotal, // Branch receives the full amount
      isPickupOrder,
    };
  }, [orderState.totalPrice, orderState.deliveryEnabled]);

  // Handle phone call
  const handlePhoneCall = () => {
    const phoneNumber = orderState.customerPhone || orderState.customer?.phone;
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  // Handle PayLater approval/rejection
  const handlePayLaterDecision = async (decision: 'APPROVE' | 'REJECT') => {
    setPayLaterLoading(true);
    try {
      const response = await api.post('/pay-later/decision', {
        orderId: orderState._id,
        decision: decision
      });
      
      if (response.data.success) {
        const newStatus: 'approved' | 'rejected' = decision === 'APPROVE' ? 'approved' : 'rejected';
        setPayLaterStatus(newStatus);
        
        // Update order state
        const updatedOrder = {
          ...orderState,
          payLater: {
            requested: orderState.payLater?.requested ?? false,
            partialPaid: orderState.payLater?.partialPaid ?? 0,
            status: newStatus
          }
        };
        setOrderState(updatedOrder);
        updateOrder(orderState._id, updatedOrder);
        
        Alert.alert(
          'Success',
          `PayLater request has been ${decision === 'APPROVE' ? 'approved' : 'rejected'} successfully.`
        );
      }
    } catch (error) {
      console.error('PayLater decision error:', error);
      Alert.alert(
        'Error',
        'Failed to process PayLater request. Please try again.'
      );
    } finally {
      setPayLaterLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Icon name="check-circle" size={32} color="#2ecc71" />
        <Text style={styles.title}>Order Ready for Pickup</Text>
        <Text style={styles.orderId}>#{orderState.orderId}</Text>
      </View>

      {/* Customer Information */}
      {(orderState.customerName || orderState.customerPhone || orderState.customer?.name || orderState.customer?.phone) && (
        <View style={styles.customerCard}>
          
          <View style={styles.customerDetails}>
            {(orderState.customerName || orderState.customer?.name) && (
              <View style={styles.customerRow}>
                <Icon name="account-circle" size={20} color="#7f8c8d" />
                <Text style={styles.customerName}>
                  {orderState.customerName || orderState.customer?.name}
                </Text>
              </View>
            )}
            {(orderState.customerPhone || orderState.customer?.phone) && (
              <TouchableOpacity 
                style={styles.customerRow} 
                onPress={handlePhoneCall}
                activeOpacity={0.7}
              >
                <Icon name="phone" size={20} color="#2ecc71" />
                <Text style={styles.customerPhone}>
                  {orderState.customerPhone || orderState.customer?.phone}
                </Text>
                <Icon name="call" size={16} color="#2ecc71" style={styles.callIcon} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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
                  {item.item.isPacket === false
                    ? `${item.quantity} ${item.item.unit}`
                    : `${item.count} x ₹${(item.item.price || 0).toFixed(2)}`}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                ₹
                {item.item.isPacket === false
                  ? (item.finalPrice || 0).toFixed(2)
                  : ((item.item.price || 0) * item.count).toFixed(2)}
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

      {/* PayLater Section */}
      {orderState.payLater?.requested && (
        <View style={styles.payLaterCard}>
          <Text style={styles.payLaterTitle}>PayLater Request</Text>
          
          {payLaterStatus || orderState.payLater?.status === 'approved' ? (
            <View style={styles.payLaterApproved}>
              <Icon name="check-circle" size={24} color="#2ecc71" />
              <Text style={styles.payLaterApprovedText}>
                PayLater Request is Approved
              </Text>
            </View>
          ) : payLaterStatus === 'rejected' || orderState.payLater?.status === 'rejected' ? (
            <View style={styles.payLaterRejected}>
              <Icon name="cancel" size={24} color="#e74c3c" />
              <Text style={styles.payLaterRejectedText}>
                PayLater Request is Rejected
              </Text>
            </View>
          ) : (
            <View style={styles.payLaterButtons}>
              <TouchableOpacity
                style={[styles.payLaterButton, styles.approveButton]}
                onPress={() => handlePayLaterDecision('APPROVE')}
                disabled={payLaterLoading}
              >
                {payLaterLoading ? (
                  <Text style={styles.payLaterButtonText}>Processing...</Text>
                ) : (
                  <>
                    <Icon name="check" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text style={styles.payLaterButtonText}>Approve PayLater</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.payLaterButton, styles.rejectButton]}
                onPress={() => handlePayLaterDecision('REJECT')}
                disabled={payLaterLoading}
              >
                <Icon name="close" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.payLaterButtonText}>Reject PayLater</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

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
  payLaterCard: {
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
  payLaterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 15,
    textAlign: 'center',
  },
  payLaterButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  payLaterButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#2ecc71',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
  },
  payLaterButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  payLaterApproved: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#d5f4e6',
    borderRadius: 8,
  },
  payLaterApprovedText: {
    color: '#2ecc71',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  payLaterRejected: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fdeaea',
    borderRadius: 8,
  },
  payLaterRejectedText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  customerCard: {
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
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  customerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34495e',
    marginLeft: 10,
  },
  customerDetails: {
    gap: 12,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  customerName: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 12,
    fontWeight: '500',
  },
  customerPhone: {
    fontSize: 16,
    color: '#2ecc71',
    marginLeft: 12,
    fontWeight: '500',
    flex: 1,
  },
  callIcon: {
    marginLeft: 8,
  },
});

export default OrderHasPacked;
