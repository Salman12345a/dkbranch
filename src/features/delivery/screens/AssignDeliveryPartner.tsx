import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {useStore} from '../../../store/ordersStore';
import api, {
  fetchOrderDetails,
  fetchDeliveryPartners,
} from '../../../services/api';

type AssignDeliveryPartnerProps = StackScreenProps<
  RootStackParamList,
  'AssignDeliveryPartner'
>;

interface Partner {
  _id: string;
  name: string;
  availability: boolean;
  status: 'pending' | 'approved' | 'rejected';
  currentOrders?: string[];
}

const AssignDeliveryPartner: React.FC<AssignDeliveryPartnerProps> = ({
  route,
  navigation,
}) => {
  const {order: initialOrder} = route.params;
  const {userId, updateOrder} = useStore();
  const [orderState, setOrderState] = useState(initialOrder);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrderAndPartners = async () => {
      try {
        setLoading(true);
        const orderData = await fetchOrderDetails(initialOrder._id);
        setOrderState(orderData);
        updateOrder(initialOrder._id, orderData);

        if (!orderData.deliveryEnabled) {
          Alert.alert(
            'Error',
            'This screen is for delivery-enabled orders only',
          );
          navigation.goBack();
          return;
        }

        const branchPartners = await fetchDeliveryPartners(userId);
        const approvedPartners = branchPartners.filter(
          (p: Partner) => p.status?.toLowerCase() === 'approved',
        );

        setPartners(approvedPartners);
      } catch (error) {
        console.error('Load Error:', error);
        Alert.alert('Error', 'Failed to load order or partners');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    loadOrderAndPartners();
  }, [initialOrder._id, userId, navigation, updateOrder]);

  useEffect(() => {
    if (orderState.status === 'delivered') {
      Alert.alert('Success', 'Order delivered, moved to history');
      navigation.navigate('OrderHistory', {screen: 'delivery'});
    }
  }, [orderState.status, navigation]);

  const handleAssignDelivery = async (partnerId?: string) => {
    try {
      const selectedPartnerId =
        partnerId || (partners.length === 1 ? partners[0]._id : null);
      if (!selectedPartnerId) {
        setIsModalVisible(true);
        return;
      }

      setLoading(true);
      const response = await api.patch(
        `/orders/${orderState._id}/assign/${selectedPartnerId}`,
      );

      setOrderState(response.data);
      updateOrder(orderState._id, response.data);
      Alert.alert('Success', 'Delivery partner assigned successfully');
      navigation.goBack();
    } catch (error) {
      console.error('Assign Error:', error);
      Alert.alert('Error', 'Failed to assign delivery partner');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'packed':
        return '#FF9800';
      case 'assigned':
        return '#2196F3';
      case 'delivered':
        return '#4CAF50';
      default:
        return '#9E9E9E';
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Order #{orderState.orderId}</Text>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusIndicator,
              {backgroundColor: getStatusColor(orderState.status)},
            ]}
          />
          <Text style={styles.statusText}>{orderState.status}</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Order Items</Text>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View>
      <View style={styles.summaryCard}>
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalText}>Subtotal</Text>
          <Text style={styles.subtotalValue}>
            ₹{orderState.totalPrice || 0}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalText}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{orderState.totalPrice || 0}</Text>
        </View>

        {orderState.modificationHistory &&
          orderState.modificationHistory.length > 0 && (
            <View style={styles.changes}>
              <Text style={styles.changesTitle}>Order Changes</Text>
              {orderState.modificationHistory[0].changes.map(
                (change, index) => (
                  <Text key={index} style={styles.changeText}>
                    • {change}
                  </Text>
                ),
              )}
            </View>
          )}
      </View>

      {orderState.status === 'packed' && (
        <View style={styles.assignSection}>
          {partners.length === 0 ? (
            <Text style={styles.noPartners}>
              No approved delivery partners available
            </Text>
          ) : (
            <>
              <Text style={styles.partnerListTitle}>
                Select Delivery Partner
              </Text>
              <FlatList
                data={partners}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.partnerItem}
                    onPress={() => handleAssignDelivery(item._id)}>
                    <View style={styles.partnerContent}>
                      <Text style={styles.partnerName}>{item.name}</Text>
                      <View style={styles.partnerOrderCount}>
                        <Text style={styles.orderCountText}>
                          {item.currentOrders?.length || 0} active orders
                        </Text>
                      </View>
                    </View>
                    <View style={styles.partnerArrow}>
                      <Text style={styles.arrowIcon}>›</Text>
                    </View>
                  </TouchableOpacity>
                )}
                keyExtractor={item => item._id}
                scrollEnabled={partners.length > 3}
                nestedScrollEnabled
              />
              {partners.length === 1 && (
                <TouchableOpacity
                  onPress={() => handleAssignDelivery()}
                  style={styles.assignButton}>
                  <Text style={styles.assignButtonText}>Assign Delivery</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {orderState.status === 'assigned' && (
        <View style={styles.statusCard}>
          <View style={styles.statusIconContainer}>
            <View style={styles.processingIcon} />
          </View>
          <Text style={styles.assignedText}>
            Order assigned, awaiting delivery
          </Text>
        </View>
      )}

      {orderState.status === 'delivered' && (
        <View style={styles.statusCard}>
          <View style={styles.statusIconContainer}>
            <View style={styles.deliveredIcon} />
          </View>
          <Text style={styles.deliveredText}>Order delivered successfully</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5722" />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.container}>
        <FlatList
          data={orderState.items}
          renderItem={({item}) => (
            <View style={styles.itemCard}>
              <View style={styles.itemContent}>
                <View style={styles.itemCountContainer}>
                  <Text style={styles.itemCount}>{item.count}x</Text>
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName}>
                    {item.item.name || 'Unknown Item'}
                  </Text>
                  <Text style={styles.itemPrice}>₹{item.item.price || 0}</Text>
                </View>
                <Text style={styles.itemTotal}>
                  ₹{(item.item.price || 0) * item.count}
                </Text>
              </View>
            </View>
          )}
          keyExtractor={item => item._id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
        />
      </View>

      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Delivery Partner</Text>
            <FlatList
              data={partners}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.modalPartnerItem}
                  onPress={() => {
                    handleAssignDelivery(item._id);
                    setIsModalVisible(false);
                  }}>
                  <Text style={styles.partnerName}>{item.name}</Text>
                  <Text style={styles.orderCountText}>
                    {item.currentOrders?.length || 0} active orders
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item._id}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsModalVisible(false)}>
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#606060',
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#606060',
    textTransform: 'capitalize',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F7F8FA',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#606060',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  itemCountContainer: {
    backgroundColor: '#F7F8FA',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#606060',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 13,
    color: '#606060',
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subtotalText: {
    fontSize: 14,
    color: '#606060',
  },
  subtotalValue: {
    fontSize: 14,
    color: '#606060',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  changes: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  changesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF5722',
    marginBottom: 8,
  },
  changeText: {
    fontSize: 13,
    color: '#606060',
    marginBottom: 4,
    lineHeight: 18,
  },
  assignSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  partnerListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  partnerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F7F8FA',
    marginBottom: 8,
  },
  partnerContent: {
    flex: 1,
  },
  partnerName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  partnerOrderCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderCountText: {
    fontSize: 13,
    color: '#606060',
  },
  partnerArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 20,
    color: '#606060',
    fontWeight: '600',
  },
  noPartners: {
    fontSize: 15,
    color: '#606060',
    textAlign: 'center',
    padding: 16,
  },
  assignButton: {
    backgroundColor: '#FF5722',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  processingIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderTopColor: 'transparent',
  },
  deliveredIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
  },
  assignedText: {
    fontSize: 15,
    color: '#2196F3',
    textAlign: 'center',
  },
  deliveredText: {
    fontSize: 15,
    color: '#4CAF50',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalPartnerItem: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#F7F8FA',
    marginBottom: 8,
  },
  closeButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AssignDeliveryPartner;
