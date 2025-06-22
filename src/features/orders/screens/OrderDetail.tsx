import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import UniversalAdd from '../../../components/common/UniversalAdd';
import ToggleButton from '../../../components/common/ToggleButton';
import api from '../../../services/api';
import {useStore, Order} from '../../../store/ordersStore';
import socketService from '../../../services/socket';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Item {
  _id: string;
  name: string;
  price: number;
  isPacket?: boolean;
  unit?: string;
}

// Extended Order type with additional runtime properties
interface ExtendedOrder extends Omit<Order, 'totalPrice'> {
  deliveryEnabled?: boolean;
  totalPrice: number;
  customer?: string;
  modificationLocked?: boolean;
  amount?: {
    delivery?: number;
    tax?: number;
  };
  branch?: string;
}

interface OrderDetailProps
  extends StackScreenProps<RootStackParamList, 'OrderDetail'> {}

const OrderDetail: React.FC<OrderDetailProps> = ({route, navigation}) => {
  const {order: initialOrder, fromPackedTab} = route.params || {};
  const {updateOrder, orders} = useStore();
  const currentOrder = (orders.find(o => o._id === initialOrder._id) ||
    initialOrder) as ExtendedOrder;
  const [updatedItems, setUpdatedItems] = useState(currentOrder.items);
  const [hasModified, setHasModified] = useState(false);
  const [totalAmountState, setTotalAmountState] = useState(
    currentOrder.totalPrice || 0,
  );
  const [loading, setLoading] = useState(false);
  const [showCancelFeedback, setShowCancelFeedback] = useState(false);
  const [cancelCountdown, setCancelCountdown] = useState(30);
  const cancelTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track if modification has been submitted
  const [modificationSubmitted, setModificationSubmitted] = useState(false);

  // Simplified loading state management

  // Fetch detailed order data if price or totalPrice is missing
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        console.log('Loading order details for:', currentOrder._id);
        const response = await api.get(`/orders/${currentOrder._id}`);
        // Process and log the items to understand their structure
        const items = response.data.items.map((item: any) => {
          // Check if this is a loose product
          if (item.item.isPacket === false) {
            console.log('Loose product details:', {
              name: item.item.name,
              isPacket: item.item.isPacket,
              quantity: item.quantity,
              count: item.count, 
              finalPrice: item.finalPrice,
              price: item.item.price
            });
          }
          return item;
        });
        setUpdatedItems(items);
        setTotalAmountState(response.data.totalPrice || 0);
        console.log('Order details loaded successfully');
      } catch (error: any) {
        console.error('Fetch Order Details Error:', error);
        Alert.alert('Error', 'Failed to load order details');
      } finally {
        // Add a small delay before hiding the loading indicator to ensure UI has time to update
        setTimeout(() => {
          setLoading(false);
        }, 300);
      }
    };

    // Check if price or totalPrice is missing
    if (
      !currentOrder.items.some(i => i.item.price) ||
      !currentOrder.totalPrice
    ) {
      fetchDetails();
    } else {
      // Process current items to capture quantity for loose products
      const processedItems = currentOrder.items.map(item => {
        if (item.item.isPacket === false) {
          console.log('Processing loose product:', {
            name: item.item.name,
            isPacket: item.item.isPacket,
            quantity: item.quantity,
            count: item.count,
            finalPrice: item.finalPrice
          });
        }
        return item;
      });
      setUpdatedItems(processedItems);
      setTotalAmountState(currentOrder.totalPrice || 0);
    }
  }, [currentOrder]);

  // Socket connection for customer
  useEffect(() => {
    const customerId = currentOrder.customer || '67b4dd5abe2479aa2cfe45a0';
    socketService.connectCustomer(customerId, updateOrder);
    return () => socketService.disconnect();
  }, [currentOrder.customer]);

  // Update total amount when items are modified
  useEffect(() => {
    const newTotal = updatedItems.reduce((sum, item) => {
      // Skip items that have been toggled off
      if (item.isIncluded === false) {
        return sum;
      }
      
      // For loose products, use quantity field from API
      if (item.item.isPacket === false) {
        // API provides quantity field for loose products
        const looseQuantity = typeof item.quantity === 'number' ? item.quantity : 
                             (typeof item.customQuantity === 'number' ? item.customQuantity : item.count);
        return sum + item.item.price * looseQuantity;
      }
      return sum + item.item.price * item.count;
    }, 0);
    setTotalAmountState(newTotal);
  }, [updatedItems]);

  // Check for modifications
  useEffect(() => {
    const isModified = updatedItems.some((updatedItem, index) => {
      const originalItem = initialOrder.items[index];
      return updatedItem.count !== originalItem.count;
    });
    setHasModified(isModified);
  }, [updatedItems, initialOrder.items]);

  const getItemCount = (itemId: string) =>
    updatedItems.find(i => i._id === itemId)?.count || 0;

  const addItem = (item: any) => {
    setUpdatedItems(prev =>
      prev.map(i =>
        i._id === item._id
          ? {
              ...i,
              count: Math.min(
                i.count + 1,
                initialOrder.items.find(o => o._id === i._id)?.count || i.count,
              ),
            }
          : i,
      ),
    );
  };

  const removeItem = (itemId: string) => {
    setUpdatedItems(prev =>
      prev.map(i =>
        i._id === itemId ? {...i, count: Math.max(0, i.count - 1)} : i,
      ),
    );
  };

  // Toggle loose product availability
  const toggleLooseProduct = (itemId: string, isIncluded: boolean) => {
    setUpdatedItems(prev =>
      prev.map(i =>
        i._id === itemId
          ? {
              ...i,
              isIncluded: isIncluded,
              count: isIncluded ? initialOrder.items.find(o => o._id === i._id)?.count || i.count : 0,
              // Always keep the item in the list (just marked as unavailable)
              visible: true
            }
          : i,
      ),
    );
    setHasModified(true);
  };

  const startCancelProcess = () => {
    if (currentOrder.status === 'packed') return;

    setShowCancelFeedback(true);
    setCancelCountdown(30);

    // Start countdown
    cancelTimerRef.current = setInterval(() => {
      setCancelCountdown(prev => {
        if (prev <= 1) {
          if (cancelTimerRef.current) {
            clearInterval(cancelTimerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCancelProcess = () => {
    if (cancelTimerRef.current) {
      clearInterval(cancelTimerRef.current);
    }
    setShowCancelFeedback(false);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) {
        clearInterval(cancelTimerRef.current);
      }
    };
  }, []);

  const handleCancelOrder = async () => {
    // First cancel the feedback UI
    cancelCancelProcess();

    Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
      {
        text: 'No',
        style: 'cancel',
      },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            const response = await api.patch(
              `/orders/${currentOrder._id}/cancel`,
            );
            updateOrder(currentOrder._id, response.data);
            navigation.goBack();
          } catch (error: any) {
            console.error('Cancel Order Error:', error);
            Alert.alert('Error', 'Failed to cancel order');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleAccept = async () => {
    try {
      setLoading(true);
      await api.patch(`/orders/${currentOrder._id}/accept`);
      const updatedOrder = {...currentOrder, status: 'accepted'};
      updateOrder(currentOrder._id, updatedOrder);
    } catch (error: any) {
      console.error('Accept Order Error:', error);
      Alert.alert('Error', 'Failed to accept order');
    } finally {
      setLoading(false);
    }
  };

  const handleModifyOrder = async () => {
    Alert.alert(
      'Modify Order',
      'After modifying this order, you will not be able to modify it again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Modify',
          onPress: async () => {
            try {
              setLoading(true);
              if (currentOrder.status !== 'accepted') {
                await handleAccept();
              }
              const modifiedItems = updatedItems.map(item => {
                // Skip items that have been toggled off (loose products marked as unavailable)
                if (item.isIncluded === false) {
                  return {
                    item: (item.item as Item)._id || item.item,
                    count: 0, // Set count to 0 for removed loose products
                  };
                }
                
                return {
                  item: (item.item as Item)._id || item.item,
                  count: item.count,
                  customQuantity: item.customQuantity,
                };
              });

              await api.patch(`/orders/${currentOrder._id}/modify`, {
                modifiedItems,
                totalPrice: totalAmountState,
              });
              setHasModified(false);
              
              // Set modification as submitted to show cancel icons
              setModificationSubmitted(true);

              // Update order with a flag to prevent further modifications
              updateOrder(currentOrder._id, {
                ...currentOrder,
                items: updatedItems,
                totalPrice: totalAmountState,
                status: currentOrder.status,
                modificationLocked: true,
              } as Order);

              // Show success message
              Alert.alert(
                'Order Modified',
                'Order has been modified successfully. No further modifications are allowed.',
              );
            } catch (error: any) {
              console.error(
                'Modify Order Error:',
                error.response?.data || error.message,
              );
              Alert.alert(
                'Error',
                `Failed to modify order: ${
                  error.response?.data?.message || error.message
                }`,
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handlePackedOrder = async () => {
    try {
      setLoading(true);
      if (currentOrder.status !== 'accepted') {
        await handleAccept();
      }
      const response = await api.patch(`/orders/${currentOrder._id}/pack`);
      const updatedOrder = response.data as ExtendedOrder;
      updateOrder(currentOrder._id, updatedOrder);

      // Navigate based on deliveryEnabled after packing
      if (updatedOrder.deliveryEnabled) {
        console.log('Navigating to AssignDeliveryPartner:', updatedOrder);
        navigation.replace('AssignDeliveryPartner', {order: updatedOrder});
      } else {
        // Show success message for orders with deliveryEnabled = false
        Alert.alert(
          'Order Packed',
          'Customer has been notified that their order is packed and ready.',
          [
            {
              text: 'OK',
              onPress: () =>
                navigation.replace('OrderHasPacked', {order: updatedOrder}),
            },
          ],
        );
      }
    } catch (error: any) {
      console.error(
        'Packed Order Error:',
        error.response?.data || error.message,
      );
      Alert.alert(
        'Error',
        `Failed to pack order: ${
          error.response?.data?.message || error.message
        }`,
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'placed':
        return '#FF9800';
      case 'accepted':
        return '#5E60CE';
      case 'packed':
        return '#00BFA6';
      case 'cancelled':
        return '#F43F5E';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'placed':
        return 'receipt';
      case 'accepted':
        return 'check-circle';
      case 'packed':
        return 'inventory';
      case 'cancelled':
        return 'cancel';
      default:
        return 'help';
    }
  };

  const renderEmptyList = () => (
    <View style={styles.emptyList}>
      <Icon name="shopping-bag" size={50} color="#ccc" />
      <Text style={styles.emptyListText}>No items in this order</Text>
    </View>
  );

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.listHeaderText}>Order Items</Text>
      <Text style={styles.itemCountText}>{updatedItems.length} items</Text>
    </View>
  );

  const renderItemSeparator = () => <View style={styles.itemSeparator} />;

  const canModifyOrder =
    currentOrder.status !== 'packed' &&
    !currentOrder.modificationLocked &&
    hasModified;

  const canPackOrder =
    currentOrder.status !== 'packed' &&
    (!hasModified || currentOrder.modificationLocked);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {/* Simple Modern Loading Overlay - No Background Box */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5E60CE" />
        </View>
      )}
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>Order #{currentOrder.orderId}</Text>
            <View style={styles.statusContainer}>
              <Icon
                name={getStatusIcon(currentOrder.status)}
                size={14}
                color={getStatusColor(currentOrder.status)}
                style={styles.statusIcon}
              />
              <Text
                style={[
                  styles.statusText,
                  {color: getStatusColor(currentOrder.status)},
                ]}>
                {currentOrder.status.charAt(0).toUpperCase() +
                  currentOrder.status.slice(1)}
              </Text>
            </View>
          </View>

          {showCancelFeedback ? (
            <View style={styles.cancelFeedbackContainer}>
              <Text style={styles.cancelFeedbackText}>Cancel?</Text>
              <Text style={styles.cancelCountdownText}>{cancelCountdown}s</Text>
              <View style={styles.cancelFeedbackButtons}>
                <TouchableOpacity
                  onPress={cancelCancelProcess}
                  style={styles.cancelFeedbackNoButton}>
                  <Text style={styles.cancelFeedbackNoText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCancelOrder}
                  disabled={cancelCountdown > 0}
                  style={[
                    styles.cancelFeedbackYesButton,
                    cancelCountdown > 0 &&
                      styles.cancelFeedbackYesButtonDisabled,
                  ]}>
                  <Text style={styles.cancelFeedbackYesText}>Yes</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={startCancelProcess}
              disabled={currentOrder.status === 'packed'}
              style={[
                styles.cancelButton,
                currentOrder.status === 'packed' && styles.disabledCancelButton,
              ]}>
              <Icon
                name="close"
                size={20}
                color={currentOrder.status === 'packed' ? '#CCCCCC' : '#FF4D4F'}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Order Items */}
        {updatedItems.length === 0 ? (
          <View>
            {renderListHeader()}
            {renderEmptyList()}
          </View>
        ) : (
          <FlatList
            data={updatedItems}
            ListHeaderComponent={renderListHeader}
            ItemSeparatorComponent={renderItemSeparator}
            renderItem={({item}) => (
            <View style={[styles.itemRow, modificationSubmitted && (item.isIncluded === false || getItemCount(item._id) === 0) && styles.removedItemRow]}>
              <Image source={{ uri: item.item.imageUrl || item.item.image }} style={styles.productImage} />
              <View style={styles.itemDetails}>
                <View style={styles.nameContainer}>
                  <Text style={[styles.itemName, modificationSubmitted && (item.isIncluded === false || getItemCount(item._id) === 0) && styles.removedItemText]}>{item.item.name}</Text>
                  {item.item.isPacket === false && (
                    <View style={styles.looseTag}>
                      <Text style={styles.looseTagText}>Loose</Text>
                    </View>
                  )}
                  {/* Show cancel icon for removed products only after modification is submitted */}
                  {modificationSubmitted && (item.isIncluded === false || getItemCount(item._id) === 0) && (
                    <View style={styles.removedTag}>
                      <Icon name="cancel" size={14} color="#FFFFFF" />
                      <Text style={styles.removedTagText}>Removed</Text>
                    </View>
                  )}
                </View>
                
                {/* Display unit price and calculated price for loose products */}
                <View>
                  <Text style={styles.itemPrice}>
  ₹{item.item.price}/
  {item.item.quantity
    ? `${item.item.quantity} ${item.item.unit || 'unit'}`
    : item.item.unit || 'unit'}
</Text>
                  {item.item.isPacket === false && (
                    <View>
                      {/* Show only the final price for loose products */}
                      <Text style={styles.finalPrice}>
                        {item.finalPrice ? 
                          `Total: ₹${item.finalPrice.toFixed(2)}` : 
                          `Total: ₹${(item.item.price * (typeof item.quantity === 'number' ? item.quantity : 
                                         (typeof item.customQuantity === 'number' ? item.customQuantity : item.count))).toFixed(2)}`
                        }
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.quantityContainer}>
                {currentOrder.status !== 'packed' && !currentOrder.modificationLocked ? (
                  // Different UI for loose vs packed products
                  item.item.isPacket === false ? (
                    <View style={styles.looseItemControls}>
                      {/* Always show quantity */}
                      <Text style={styles.quantityText}>
                        {typeof item.quantity === 'number' ? item.quantity : 
                         (typeof item.customQuantity === 'number' ? item.customQuantity : item.count)} {item.item.unit || 'unit'}
                      </Text>
                      
                      {/* Always show the toggle button */}
                      <ToggleButton
                        item={item}
                        isIncluded={item.isIncluded !== false}
                        onToggle={toggleLooseProduct}
                      />
                      
                      {/* Only show these elements after modification is submitted */}
                      {modificationSubmitted && item.isIncluded === false && (
                        <>
                          <Text style={[styles.quantityText, styles.unavailableText]}>
                            Unavailable
                          </Text>
                          <Icon name="cancel" size={18} color="#FF4D4F" style={styles.cancelIcon} />
                        </>
                      )}
                    </View>
                  ) : (
                    <UniversalAdd
                      item={item}
                      count={getItemCount}
                      addItem={addItem}
                      removeItem={removeItem}
                    />
                  )
                ) : (
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityText}>
                      {item.item.isPacket === false
                        ? `${typeof item.quantity === 'number' ? item.quantity : 
                            (typeof item.customQuantity === 'number' ? item.customQuantity : item.count)} ${item.item.unit || 'unit'}`
                        : getItemCount(item._id)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Summary */}
        <View style={styles.summary}>
          {/* Display individual item breakdowns for loose products */}
          {updatedItems.some(item => item.item.isPacket === false && !item.isIncluded === false) && (
            <View style={styles.itemBreakdown}>
              <Text style={styles.breakdownHeader}>Item Breakdown:</Text>
              {updatedItems
                .filter(item => item.item.isPacket === false)
                .map((item, index) => {
                  // Use quantity field from API for loose products
                  const looseQuantity = typeof item.quantity === 'number' ? item.quantity : 
                                      (typeof item.customQuantity === 'number' ? item.customQuantity : item.count);
                  return (
                    <View key={index} style={[styles.breakdownItem, modificationSubmitted && item.isIncluded === false && styles.removedBreakdownItem]}>
                      <View style={styles.breakdownItemNameContainer}>
                        <Text style={[styles.breakdownItemName, modificationSubmitted && item.isIncluded === false && styles.removedItemText]}>
                          {item.item.name} ({looseQuantity} {item.item.unit || 'unit'})
                        </Text>
                        {modificationSubmitted && item.isIncluded === false && (
                          <Icon name="cancel" size={14} color="#FF4D4F" style={styles.breakdownCancelIcon} />
                        )}
                      </View>
                      <Text style={[styles.breakdownItemPrice, modificationSubmitted && item.isIncluded === false && styles.removedItemText]}>
                        {modificationSubmitted && item.isIncluded === false ? 'Removed' : 
                          (item.finalPrice ? 
                            `₹${item.finalPrice.toFixed(2)}` : 
                            `₹${(item.item.price * looseQuantity).toFixed(2)}`
                          )
                        }
                      </Text>
                    </View>
                  );
                })}
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items Total</Text>
            <Text style={styles.summaryValue}>
              ₹{totalAmountState.toFixed(2)}
            </Text>
          </View>

          {currentOrder.amount?.delivery ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>
                ₹{currentOrder.amount.delivery.toFixed(2)}
              </Text>
            </View>
          ) : null}

          {currentOrder.amount?.tax ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>
                ₹{currentOrder.amount.tax.toFixed(2)}
              </Text>
            </View>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>
              ₹
              {(
                totalAmountState +
                (currentOrder.amount?.delivery || 0) +
                (currentOrder.amount?.tax || 0)
              ).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Modification Note */}
        {currentOrder.modificationLocked &&
          currentOrder.status !== 'packed' && (
            <View style={styles.note}>
              <Icon
                name="info"
                size={16}
                color="#5E60CE"
                style={styles.noteIcon}
              />
              <Text style={styles.noteText}>
                This order has been modified and cannot be modified again.
              </Text>
            </View>
          )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {currentOrder.status === 'packed' &&
          currentOrder.deliveryEnabled &&
          !fromPackedTab ? (
            <TouchableOpacity
              onPress={() => {
                console.log(
                  'Navigating to AssignDeliveryPartner:',
                  currentOrder,
                );
                navigation.navigate('AssignDeliveryPartner', {
                  order: currentOrder,
                });
              }}
              style={styles.primaryButton}>
              <Icon
                name="local-shipping"
                size={20}
                color="#fff"
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>Assign Delivery Partner</Text>
            </TouchableOpacity>
          ) : (
            <>
              {canModifyOrder && (
                <TouchableOpacity
                  onPress={handleModifyOrder}
                  disabled={loading}
                  style={[
                    styles.modifyButton,
                    loading && styles.disabledButton,
                  ]}>
                  <Icon
                    name="edit"
                    size={20}
                    color="#fff"
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.buttonText}>Modify Order</Text>
                </TouchableOpacity>
              )}

              {canPackOrder && (
                <TouchableOpacity
                  onPress={handlePackedOrder}
                  disabled={loading}
                  style={[
                    styles.primaryButton,
                    loading && styles.disabledButton,
                  ]}>
                  <Icon
                    name="inventory-2"
                    size={20}
                    color="#fff"
                    style={styles.buttonIcon}
                  />
                  <Text style={styles.buttonText}>Mark as Packed</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFEEEE',
    backgroundColor: '#FFF5F5',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  itemCountText: {
    fontSize: 14,
    color: '#6B7280',
  },
  list: {
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: '#111827',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  quantityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  quantityBadge: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  unavailableText: {
    color: '#FF4D4F',
    fontStyle: 'italic',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemBreakdown: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  breakdownHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  breakdownItemName: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
  },
  breakdownItemNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  breakdownCancelIcon: {
    marginLeft: 8,
  },
  removedBreakdownItem: {
    backgroundColor: '#FFF5F5',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  breakdownItemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  looseTag: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  looseTagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  looseItemControls: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removedItemRow: {
    backgroundColor: '#FFF5F5',
    opacity: 0.8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF4D4F',
  },
  removedItemText: {
    color: '#FF4D4F',
    textDecorationLine: 'line-through',
  },
  removedTag: {
    backgroundColor: '#FF4D4F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  removedTagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  finalPrice: {
    fontSize: 12,
    color: '#5E60CE',
    fontWeight: '500',
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  cancelIcon: {
    marginTop: 5,
  },
  itemSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 16,
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyListText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  summary: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F3FF',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  noteIcon: {
    marginRight: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  actionsContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  primaryButton: {
    backgroundColor: '#5E60CE',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  modifyButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledCancelButton: {
    borderColor: '#EEEEEE',
    backgroundColor: '#F5F5F5',
  },
  cancelFeedbackContainer: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FFEEEE',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    width: 100,
  },
  cancelFeedbackText: {
    color: '#FF4D4F',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  cancelCountdownText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cancelFeedbackButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelFeedbackNoButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flex: 1,
    marginRight: 4,
    alignItems: 'center',
  },
  cancelFeedbackNoText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  cancelFeedbackYesButton: {
    backgroundColor: '#FF4D4F',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flex: 1,
    marginLeft: 4,
    alignItems: 'center',
  },
  cancelFeedbackYesButtonDisabled: {
    backgroundColor: '#FFCCCB',
  },
  cancelFeedbackYesText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default OrderDetail;
