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
  ActivityIndicator,
} from 'react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {useStore, Order} from '../../../store/ordersStore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../services/api';
import NativeBannerAd from '../../../components/admob/NativeBannerAd';

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
  branchConfirmedCollection?: boolean;
  customer?: {
    name?: string;
    phone?: string;
  };
  payLater?: {
    requested: boolean;
    status: 'pending' | 'approved' | 'rejected';
    partialPaid: number;
  };
  modificationHistory?: Array<{
    changes?: string[];
  }>;
}


const OrderHasPacked: React.FC<OrderHasPackedProps> = ({route, navigation}) => {
  const {order: initialOrder} = route.params;
  const {updateOrder} = useStore();
  const [orderState, setOrderState] = useState(initialOrder as ExtendedOrder);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [payLaterLoading, setPayLaterLoading] = useState(false);
  const [payLaterStatus, setPayLaterStatus] = useState<'approved' | 'rejected' | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  // Fetch latest order data on mount to ensure item details are present
  useEffect(() => {
    let isActive = true;

    const fetchOrderDetails = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await api.get(`/orders/${initialOrder._id}`, {
          timeout: 15000,
        });

        if (!response.data || !Array.isArray(response.data.items)) {
          throw new Error('The order details response is incomplete.');
        }

        if (!isActive) {
          return;
        }

        setOrderState(response.data as ExtendedOrder);
        updateOrder(initialOrder._id, response.data);
      } catch (error: any) {
        console.error('Fetch Order Error:', error);

        if (isActive) {
          setLoadError(
            error?.code === 'ECONNABORTED'
              ? 'The request timed out. Please check your connection and try again.'
              : 'Unable to load the latest order details. Please check your connection and try again.',
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchOrderDetails();

    return () => {
      isActive = false;
    };
  }, [initialOrder._id, reloadKey, updateOrder]);

  // Calculate order totals without any platform charges
  const orderCalculations = useMemo(() => {
    const orderTotal = orderState.totalPrice || 0;
    const isPickupOrder = orderState.deliveryEnabled === false;

    return {
      orderTotal,
      customerPlatformCharge: 0, // No platform charges
      finalCustomerTotal: orderTotal, // Customer pays only order total
      branchPlatformCharge: 0, // No platform charge for the branch
      branchReceives: orderTotal, // Branch receives the full amount
      isPickupOrder,
    };
  }, [orderState.totalPrice, orderState.deliveryEnabled]);

  // Keep all hooks above conditional returns so their order never changes.
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E60CE" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loadingContainer}>
        <Icon name="cloud-off" size={44} color="#e74c3c" />
        <Text style={styles.errorTitle}>Could not load order</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => setReloadKey(key => key + 1)}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

  // Handle order completion
  const handleCompleteOrder = async () => {
    setCompletionLoading(true);
    try {
      const response = await api.patch(`/orders/${orderState._id}/complete`);
      
      if (response.data.status === 'SUCCESS') {
        // Update order state to reflect completion
        const updatedOrder = {
          ...orderState,
          status: 'packed',
          branchConfirmedCollection: true
        };
        setOrderState(updatedOrder);
        updateOrder(orderState._id, updatedOrder);
        
        Alert.alert(
          'Success',
          'Order has been marked as complete successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Order completion error:', error);
      Alert.alert(
        'Error',
        'Failed to complete the order. Please try again.'
      );
    } finally {
      setCompletionLoading(false);
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
      {(orderState.customerPhone || orderState.customer?.phone) && (
        <View style={styles.customerCard}>
          <View style={styles.customerDetails}>
            <TouchableOpacity 
              style={styles.customerPhoneButton} 
              onPress={handlePhoneCall}
              activeOpacity={0.7}
            >
              <Icon name="phone" size={20} color="#FFFFFF" />
              <Text style={styles.customerPhoneText}>
                {(() => {
                  const phone = orderState.customerPhone || orderState.customer?.phone;
                  if (!phone) return 'Phone not available';
                  // Remove country code (91) if present and format as local number
                  const phoneStr = phone.toString();
                  if (phoneStr.startsWith('91') && phoneStr.length === 12) {
                    return phoneStr.substring(2);
                  }
                  return phoneStr;
                })()}
              </Text>
              <Icon name="person" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Items</Text>
        <FlatList
          data={orderState.items}
          renderItem={({item}) => {
            const itemData = typeof item?.item === 'object' ? item.item : null;
            return (
            <View style={styles.item}>
              <Icon
                name="inventory"
                size={20}
                color="#3498db"
                style={styles.itemIcon}
              />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>
                  {itemData?.name || 'Unknown Item'}
                </Text>
                <Text style={styles.itemMeta}>
                  {itemData?.isPacket === false
                    ? `${item.quantity ?? 0} ${itemData?.unit ?? ''}`
                    : `${item.count ?? 0} x ₹${(itemData?.price || 0).toFixed(2)}`}
                </Text>
              </View>
              <Text style={styles.itemTotal}>
                ₹
                {itemData?.isPacket === false
                  ? (item.finalPrice || 0).toFixed(2)
                  : ((itemData?.price || 0) * (item.count ?? 0)).toFixed(2)}
              </Text>
            </View>
            );
          }}
          keyExtractor={item => item._id}
          scrollEnabled={false}
        />
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelBold}>Total Amount</Text>
          <Text style={styles.finalTotal}>
            ₹{orderCalculations.orderTotal.toFixed(2)}
          </Text>
        </View>

        {orderState.modificationHistory &&
          orderState.modificationHistory.length > 0 && (
            <View style={styles.changes}>
              <Text style={styles.changesTitle}>Modification History:</Text>
              {orderState.modificationHistory[0]?.changes?.map(
                (change: string, index: number) => (
                  <View key={index} style={styles.changeItem}>
                    <Icon name="edit" size={14} color="#95a5a6" />
                    <Text style={styles.changeText}>{change}</Text>
                  </View>
                ),
              )}
            </View>
          )}
      </View>

      {/* Native Banner Ad */}
      <NativeBannerAd style={styles.adContainer} />

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

      {/* Complete Order button - show when order is packed but not yet completed */}
      {!orderState.branchConfirmedCollection && orderState.status === 'packed' && (
        <TouchableOpacity
          style={[styles.completedButton, completionLoading && styles.completedButtonDisabled]}
          onPress={handleCompleteOrder}
          disabled={completionLoading}>
          <Icon
            name={completionLoading ? "hourglass-empty" : "check"}
            size={24}
            color="#FFFFFF"
            style={styles.buttonIcon}
          />
          <Text style={styles.completedButtonText}>
            {completionLoading ? 'Completing...' : 'Mark as Complete'}
          </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#7f8c8d',
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  errorText: {
    marginTop: 8,
    marginHorizontal: 28,
    fontSize: 15,
    lineHeight: 21,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#5E60CE',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  goBackText: {
    marginTop: 18,
    color: '#5E60CE',
    fontSize: 15,
    fontWeight: '500',
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
  customerPhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2ecc71',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#2ecc71',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#27ae60',
  },
  customerPhoneText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
    fontWeight: '600',
    flex: 1,
  },
  adContainer: {
    marginHorizontal: 0,
    marginVertical: 12,
  },
  completedButtonDisabled: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
});

export default OrderHasPacked;
