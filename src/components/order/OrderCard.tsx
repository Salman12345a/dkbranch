import React, {useState, useEffect} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../services/api';
import {Order} from '../../store/ordersStore';

interface OrderCardProps {
  order: Order;
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onCancelItem: (orderId: string, itemId: string) => void;
  onAssignDeliveryPartner: () => void;
  navigation: any;
  onPress?: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order: initialOrder,
  onAccept,
  onReject,
  onCancelItem,
  onAssignDeliveryPartner,
  navigation,
  onPress,
}) => {
  const [order, setOrder] = useState(initialOrder);

  // Fetch order details if item names or prices are missing
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await api.get(`/orders/${initialOrder._id}`);
        console.log(
          'Fetched OrderCard Data:',
          JSON.stringify(response.data, null, 2),
        );
        setOrder(response.data);
      } catch (error) {
        console.error('Fetch OrderCard Error:', error);
      }
    };

    // Check if any item lacks name or price
    if (
      !initialOrder.items ||
      initialOrder.items.some(
        (item: any) => !item.item?.name || !item.item?.price,
      )
    ) {
      fetchOrderDetails();
    }
  }, [initialOrder._id]);

  const handleAccept = async () => {
    await api.patch(`/orders/${order._id}/accept`);
    onAccept(order._id);
  };

  const handleReject = async () => {
    await api.patch(`/orders/${order._id}/cancel`, {
      reason: 'item unavailable',
    });
    onReject(order._id);
  };

  const handleCancelItem = async (itemId: string) => {
    await api.patch(`/orders/${order._id}/cancel-item/${itemId}`);
    onCancelItem(order._id, itemId);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('OrderDetail', {order});
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'placed':
        return styles.statusPlaced;
      case 'accepted':
        return styles.statusAccepted;
      case 'packed':
        return styles.statusPacked;
      case 'cancelled':
        return styles.statusCancelled;
      case 'delivering':
        return styles.statusDelivering;
      case 'delivered':
        return styles.statusDelivered;
      default:
        return styles.statusDefault;
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
      case 'delivering':
        return 'local-shipping';
      case 'delivered':
        return 'done-all';
      case 'cancelled':
        return 'cancel';
      default:
        return 'help';
    }
  };

  // Log order.items for debugging
  console.log('OrderCard rendering:', order._id, 'orderId:', order.orderId);

  // Ensure items exist before slicing, default to empty array if not
  const displayedItems = (order?.items || []).slice(0, 2);

  // Calculate total items
  const totalItems =
    order?.items?.reduce((sum, item) => sum + (item.count || 0), 0) || 0;

  return (
    <TouchableOpacity onPress={handlePress} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.orderIdContainer}>
          <Text style={styles.orderIdLabel}>ORDER</Text>
          <Text style={styles.orderId}>#{order.orderId}</Text>
        </View>
        <View style={[styles.statusChip, getStatusStyle(order.status)]}>
          <Icon
            name={getStatusIcon(order.status)}
            size={14}
            color="#FFF"
            style={styles.statusIcon}
          />
          <Text style={styles.statusText}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.itemsContainer}>
        {displayedItems.length > 0 ? (
          displayedItems.map(item => (
            <View key={item._id} style={styles.item}>
              <View style={styles.itemDetails}>
                <View style={styles.itemCountCircle}>
                  <Text style={styles.itemCountText}>{item.count || 0}</Text>
                </View>
                <Text
                  style={styles.itemText}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.item?.name || 'Unknown Item'}
                </Text>
              </View>
              <Text style={styles.priceText}>
                ₹
                {item.item?.price
                  ? (item.item.price * (item.count || 0)).toFixed(0)
                  : '0'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.noItemsText}>No items available</Text>
        )}

        {order.items && order.items.length > 2 && (
          <View style={styles.moreItemsContainer}>
            <Text style={styles.moreItemsText}>
              +{order.items.length - 2} more item
              {order.items.length - 2 > 1 ? 's' : ''}
            </Text>
            <Icon name="chevron-right" size={16} color="#888" />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        {order.deliveryServiceAvailable && (
          <View style={styles.deliveryInfoContainer}>
            <Icon
              name="delivery-dining"
              size={16}
              color="#5E60CE"
              style={styles.deliveryIcon}
            />
            <Text style={styles.deliveryText}>Express Delivery</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    marginVertical: 8,
    backgroundColor: '#fff',
    // Lighter, simpler shadow for iOS
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    // Lighter elevation for Android
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    flexDirection: 'column',
  },
  orderIdLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginTop: 2,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 12,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemCountCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F2F3FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5E60CE',
  },
  itemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  priceText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  noItemsText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    paddingVertical: 10,
    textAlign: 'center',
  },
  moreItemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 6,
  },
  moreItemsText: {
    fontSize: 13,
    color: '#888',
    marginRight: 4,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    marginTop: 4,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalItemsText: {
    fontSize: 14,
    color: '#666',
  },
  totalAmountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  deliveryInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deliveryIcon: {
    marginRight: 6,
  },
  deliveryText: {
    fontSize: 13,
    color: '#5E60CE',
    fontWeight: '600',
  },
  statusPlaced: {backgroundColor: '#FF9800'}, // Orange
  statusAccepted: {backgroundColor: '#5E60CE'}, // Purple
  statusPacked: {backgroundColor: '#00BFA6'}, // Teal
  statusDelivering: {backgroundColor: '#4361EE'}, // Blue
  statusDelivered: {backgroundColor: '#10B981'}, // Green
  statusCancelled: {backgroundColor: '#F43F5E'}, // Red
  statusDefault: {backgroundColor: '#6B7280'}, // Gray
});

export default OrderCard;
