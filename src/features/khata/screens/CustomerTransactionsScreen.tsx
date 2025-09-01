import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../services/api';

type CustomerTransactionsScreenProps = StackScreenProps<
  RootStackParamList,
  'CustomerTransactions'
>;

interface Transaction {
  transactionId: string;
  amount: number;
  type: 'payment' | 'order';
  paidBy: string;
  refId: string;
  timestamp: string;
  note?: string;
  displayText: string;
  formattedDate: string;
  formattedTime: string;
}

const CustomerTransactionsScreen: React.FC<CustomerTransactionsScreenProps> = ({
  route,
  navigation,
}) => {
  const {customerId, customerName, customerPhone, transactions: initialTransactions, currentDue} = route.params;
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [updatedDue, setUpdatedDue] = useState(currentDue || 0);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [refreshing, setRefreshing] = useState(false);

  // Function to fetch fresh customer data
  const fetchCustomerData = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await api.get('/khata/branch');
      if (response.data && response.data.customers && response.data.customers.length > 0) {
        // Find the specific customer by ID
        const customerData = response.data.customers.find((customer: any) => customer.customerId === customerId);
        if (customerData) {
          setTransactions(customerData.transactions || []);
          setUpdatedDue(customerData.currentDue || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [customerId]);

  // Auto-refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCustomerData();
    });
    return unsubscribe;
  }, [navigation, fetchCustomerData]);

  const renderTransactionItem = ({item}: {item: Transaction}) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionIcon}>
          <Icon
            name={item.type === 'payment' ? 'payment' : 'shopping-cart'}
            size={20}
            color={item.type === 'payment' ? '#2ecc71' : '#3498db'}
          />
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionText}>{item.displayText}</Text>
          <Text style={styles.transactionDate}>
            {item.formattedDate} • {item.formattedTime}
          </Text>
          {item.note && <Text style={styles.transactionNote}>{item.note}</Text>}
        </View>
        <View style={styles.amountContainer}>
          <Text
            style={[
              styles.transactionAmount,
              item.type === 'payment' ? styles.creditAmount : styles.debitAmount,
            ]}>
            {item.type === 'payment' ? '+' : '-'}₹{item.amount.toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );

  const processPayment = async () => {
    if (!paymentAmount.trim()) {
      Alert.alert('Missing Info', 'Please enter payment amount.');
      return;
    }

    const amount = parseFloat(paymentAmount.trim());
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    if (amount > updatedDue) {
      Alert.alert(
        'Amount Too High', 
        `Payment amount cannot be more than current due amount of ₹${updatedDue.toFixed(2)}.`
      );
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await api.post('/pay-later/partial-payment', {
        customerId: customerId,
        amount: amount,
      });
      
      if (response.data.success) {
        const newDueAmount = response.data.remainingDue || (updatedDue - amount);
        setUpdatedDue(newDueAmount);
        Alert.alert('Payment Recorded!', `Payment of ₹${amount.toFixed(2)} has been recorded successfully.`);
        setShowPaymentModal(false);
        setPaymentAmount('');
        
        // Refresh the screen data after successful payment
        await fetchCustomerData();
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      Alert.alert('Problem!', 'Could not process payment. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="receipt" size={64} color="#bdc3c7" />
      <Text style={styles.emptyTitle}>No Transactions</Text>
      <Text style={styles.emptySubtitle}>
        No transaction history found for this customer
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{customerName}</Text>
          <Text style={styles.headerSubtitle}>{customerPhone}</Text>
        </View>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransactionItem}
        keyExtractor={item => item.transactionId}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshing={refreshing}
        onRefresh={fetchCustomerData}
      />
      
      {/* Current Due Display */}
      {updatedDue > 0 && (
        <View style={styles.dueContainer}>
          <Text style={styles.dueLabel}>Current Due Amount:</Text>
          <Text style={styles.dueAmount}>₹{updatedDue.toFixed(2)}</Text>
        </View>
      )}
      
      {/* Clear Dues Button */}
      {updatedDue > 0 && (
        <View style={styles.clearButtonContainer}>
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setShowPaymentModal(true)}
          >
            <Icon name="payment" size={20} color="#fff" />
            <Text style={styles.clearButtonText}>Clear Dues</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Record Payment</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowPaymentModal(false);
                    setPaymentAmount('');
                  }}
                >
                  <Icon name="close" size={24} color="#7f8c8d" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.dueInfoContainer}>
                <Text style={styles.dueInfoLabel}>Current Due Amount</Text>
                <Text style={styles.dueInfoAmount}>₹{updatedDue.toFixed(2)}</Text>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Payment Amount</Text>
                <View style={styles.amountInputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Enter payment amount"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    keyboardType="numeric"
                    autoFocus={true}
                  />
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  paymentLoading && styles.submitButtonDisabled
                ]}
                onPress={processPayment}
                disabled={paymentLoading}
              >
                {paymentLoading ? (
                  <Text style={styles.submitButtonText}>Processing...</Text>
                ) : (
                  <>
                    <Icon name="check" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Submit Payment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 5,
    marginRight: 15,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionText: {
    fontSize: 15,
    color: '#2c3e50',
    fontWeight: '500',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  transactionNote: {
    fontSize: 13,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  creditAmount: {
    color: '#2ecc71',
  },
  debitAmount: {
    color: '#e74c3c',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#95a5a6',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  dueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  dueLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  dueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  clearButtonContainer: {
    padding: 20,
    backgroundColor: '#fff',
  },
  clearButton: {
    backgroundColor: '#2ecc71',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  dueInfoContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueInfoLabel: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  dueInfoAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 10,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  currencySymbol: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
    backgroundColor: '#f1f3f4',
  },
  amountInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  submitButton: {
    backgroundColor: '#2ecc71',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomerTransactionsScreen;
