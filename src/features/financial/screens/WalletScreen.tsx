import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  fetchWalletBalance,
  fetchWalletTransactions,
  fetchWalletPayments,
  makeWalletPayment,
} from '../../../services/api';
import {
  useStore,
  WalletTransaction,
  WalletPayment,
} from '../../../store/ordersStore';
import SocketService from '../../../services/socket';
import {storage} from '../../../utils/storage';

// Format date to a readable format
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const WalletScreen = () => {
  const navigation = useNavigation();
  const {
    walletBalance,
    walletTransactions,
    walletPayments,
    setWalletBalance,
    setWalletTransactions,
    setWalletPayments,
    addWalletPayment,
    orders,
  } = useStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'payments'>(
    'transactions',
  );
  const [error, setError] = useState<string | null>(null);

  // Fetch wallet data
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [balanceData, transactionsData, paymentsData] = await Promise.all([
        fetchWalletBalance(),
        fetchWalletTransactions(),
        fetchWalletPayments(),
      ]);

      setWalletBalance(balanceData.balance);
      storage.set('walletBalance', balanceData.balance);

      // Map transactions to include orderNumber from orders
      const transactions = transactionsData.transactions
        // Ensure newest transactions appear first
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(t => ({
        ...t,
        status: t.type === 'platform_charge' ? 'settled' : 'pending',
        orderNumber:
          orders.find(o => o._id === t.orderId)?.orderId || undefined,
      }));
      setWalletTransactions(transactions);

      const payments = paymentsData.payments
        // Ensure newest payments appear first
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .map(p => ({
        ...p,
        status: 'completed' as const,
      }));
      setWalletPayments(payments);
    } catch (error: any) {
      // Check if it's a new branch (no wallet data yet)
      if (error.response?.status === 404) {
        // Initialize with empty data for new branch
        setWalletBalance(0);
        setWalletTransactions([]);
        setWalletPayments([]);
        storage.set('walletBalance', 0);
        return;
      }

      const message =
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch wallet data';
      setError(message);
      if (error.response?.status === 403) {
        Alert.alert(
          'Access Denied',
          'You do not have permission for this wallet.',
        );
      } else if (error.code === 'ERR_NETWORK') {
        Alert.alert('Network Error', 'Please check your internet connection.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Pull-to-refresh handler
  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData();
  };

  // Direct navigation to payment gateway with current wallet balance
  const navigateToPaymentGateway = () => {
    // Navigate to payment gateway with current wallet balance and branch ID
    navigation.navigate('PaymentGateway' as never, {
      paymentAmount: Math.abs(walletBalance), // Use absolute value of current balance
      branchId: storage.getString('branchId') || '',
    } as never);
  };

  // Initialize cached balance and fetch data
  useFocusEffect(
    useCallback(() => {
      const cachedBalance = storage.getNumber('walletBalance');
      if (cachedBalance !== undefined) {
        setWalletBalance(cachedBalance);
      }
      fetchWalletData();
    }, [setWalletBalance]),
  );

  // Setup WebSocket for wallet updates
  useEffect(() => {
    const branchId = storage.getString('userId');
    if (branchId) {
      SocketService.connect(branchId, {
        addOrder: useStore.getState().addOrder,
        updateOrder: useStore.getState().updateOrder,
        setWalletBalance,
        addWalletTransaction: useStore.getState().addWalletTransaction,
      });
    }
    return () => SocketService.disconnect();
  }, [setWalletBalance]);

  // Render transaction item
  const renderTransactionItem = ({item}: {item: WalletTransaction}) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionInfo}>
        <Text style={styles.orderNumber}>
          {item.orderNumber ? `Order #${item.orderNumber}` : 'Platform Charge'}
        </Text>
        <Text style={styles.transactionDate}>{formatDate(item.timestamp)}</Text>
      </View>
      <View style={styles.transactionAmountContainer}>
        <Text style={styles.transactionAmount}>₹{item.amount}</Text>
        {item.status && (
          <View
            style={[
              styles.statusBadge,
              item.status === 'settled'
                ? styles.settledBadge
                : styles.pendingBadge,
            ]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        )}
      </View>
    </View>
  );

  // Render payment item
  const renderPaymentItem = ({item}: {item: WalletPayment}) => (
    <View style={styles.paymentItem}>
      <View style={styles.paymentInfo}>
        <Text style={styles.paymentMethod}>Payment</Text>
        <Text style={styles.paymentDate}>{formatDate(item.timestamp)}</Text>
      </View>
      <View style={styles.paymentAmountContainer}>
        <Text style={styles.paymentAmount}>₹{item.amount}</Text>
        {item.status && (
          <View style={[styles.statusBadge, styles.completedBadge]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Wallet</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceTextContainer}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text
            style={[
              styles.balanceAmount,
              walletBalance >= 0
                ? styles.positiveBalance
                : styles.negativeBalance,
            ]}>
            ₹{walletBalance}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.payButton}
          onPress={navigateToPaymentGateway}>
          <Text style={styles.payButtonText}>Pay Now</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transactions' && styles.activeTab]}
          onPress={() => setActiveTab('transactions')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'transactions' && styles.activeTabText,
            ]}>
            Platform Charges
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'payments' && styles.activeTab]}
          onPress={() => setActiveTab('payments')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'payments' && styles.activeTabText,
            ]}>
            Payment History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={
            activeTab === 'transactions'
              ? walletTransactions.filter(t => t.status === 'settled')
              : walletPayments
          }
          renderItem={
            activeTab === 'transactions'
              ? renderTransactionItem
              : renderPaymentItem
          }
          keyExtractor={item => item._id || item.timestamp}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            error ? (
              <View style={styles.centerContent}>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={fetchWalletData}>
                  <Text style={styles.retryButton}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.centerContent}>
                <Icon name="inventory" size={60} color="#E0E0E0" />
                <Text style={styles.emptyText}>
                  No{' '}
                  {activeTab === 'transactions'
                    ? 'platform charges'
                    : 'payments'}{' '}
                  found
                </Text>
              </View>
            )
          }
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceTextContainer: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  positiveBalance: {
    color: '#2ECC71',
  },
  negativeBalance: {
    color: '#FF3B30',
  },
  payButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 10,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  listContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionInfo: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 14,
    color: '#666666',
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadge: {
    backgroundColor: '#FFE8E0',
  },
  settledBadge: {
    backgroundColor: '#E0F2F1',
  },
  completedBadge: {
    backgroundColor: '#E3F2FD',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
  },
  paymentItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentMethod: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 14,
    color: '#666666',
  },
  paymentAmountContainer: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ECC71',
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default WalletScreen;
