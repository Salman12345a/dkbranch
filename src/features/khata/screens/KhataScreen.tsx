import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {DrawerScreenProps} from '@react-navigation/drawer';
import {DrawerParamList} from '../../../navigation/Sidebar';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';
import {CompositeNavigationProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../services/api';
import {storage} from '../../../utils/storage';
import StickyBannerAd from '../../../components/admob/StickyBannerAd';

type KhataScreenProps = DrawerScreenProps<DrawerParamList, 'Khata'> & {
  navigation: CompositeNavigationProp<
    DrawerScreenProps<DrawerParamList, 'Khata'>['navigation'],
    StackNavigationProp<RootStackParamList>
  >;
};

interface Customer {
  customerId: string;
  customerName: string;
  customerPhone: string;
  currentDue: number;
  transactions: Transaction[];
}

interface ApprovedCustomer {
  customerId: string;
  customerName: string;
  customerPhone: string;
  payLaterEligible: boolean;
  approvedAt: string;
}

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

const KhataScreen: React.FC<KhataScreenProps> = ({navigation}) => {
  const [activeTab, setActiveTab] = useState<'khata' | 'approved'>('khata');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [approvedCustomers, setApprovedCustomers] = useState<ApprovedCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'khata') {
      fetchCustomerDues();
    } else {
      fetchApprovedCustomers();
    }
  }, [activeTab]);

  // Initial load - fetch data for the default active tab
  useEffect(() => {
    fetchCustomerDues(); // Load khata data initially since it's the default tab
  }, []);

  const fetchCustomerDues = async () => {
    setLoading(true);
    try {
      const response = await api.get('/khata/branch');
      console.log('Customer dues response:', response.data);
      
      if (response.data && response.data.customers) {
        // Filter out customers with zero or no dues
        const customersWithDues = response.data.customers.filter((customer: Customer) => 
          customer.currentDue && customer.currentDue > 0
        );
        setCustomers(customersWithDues);
      }
    } catch (error) {
      console.error('Error fetching customer dues:', error);
      Alert.alert('Error', 'Failed to fetch customer dues. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedCustomers = async () => {
    setApprovedLoading(true);
    try {
      const response = await api.get('/pay-later/eligible-customers');
      console.log('Approved customers response:', response.data);
      
      if (response.data && response.data.customers) {
        setApprovedCustomers(response.data.customers);
      } else if (response.data && Array.isArray(response.data)) {
        // Handle case where response.data is directly an array
        setApprovedCustomers(response.data);
      } else {
        // Handle empty response
        setApprovedCustomers([]);
      }
    } catch (error) {
      console.error('Error fetching approved customers:', error);
      setApprovedCustomers([]); // Set empty array on error
      Alert.alert('Error', 'Failed to fetch approved customers. Please try again.');
    } finally {
      setApprovedLoading(false);
    }
  };

  const revokeCustomerEligibility = async (customer: ApprovedCustomer) => {
    Alert.alert(
      'Stop Credit?',
      `Do you want to stop credit for ${customer.customerName}?\n\nAfter stopping, this customer cannot take credit.`,
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Stop',
          style: 'destructive',
          onPress: async () => {
            setRevokeLoading(customer.customerId);
            try {
              const response = await api.post('/pay-later/revoke-customer', {
                phone: customer.customerPhone,
              });
              
              if (response.data.success) {
                Alert.alert('Done!', 'Customer credit has been stopped.');
                // Remove customer from approved list
                setApprovedCustomers(prev => 
                  prev.filter(c => c.customerId !== customer.customerId)
                );
              }
            } catch (error) {
              console.error('Error revoking customer eligibility:', error);
              Alert.alert('Problem!', 'Could not stop credit. Please try again.');
            } finally {
              setRevokeLoading(null);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const approveCustomer = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Missing Info', 'Please enter a phone number.');
      return;
    }

    if (!customerName.trim()) {
      Alert.alert('Missing Info', 'Please enter customer name.');
      return;
    }

    const fullPhoneNumber = `+91${phoneNumber.trim()}`;
    setApproveLoading(true);
    try {
      const response = await api.post('/pay-later/approve-customer', {
        phone: fullPhoneNumber,
        customerName: customerName.trim(),
      });
      
      if (response.data.success) {
        Alert.alert('Success!', 'Customer has been approved for credit.');
        // Add new customer to approved list
        const newCustomer: ApprovedCustomer = {
          customerId: response.data.customer?.customerId || Date.now().toString(),
          customerName: customerName.trim(),
          customerPhone: fullPhoneNumber,
          payLaterEligible: true,
          approvedAt: new Date().toISOString(),
        };
        setApprovedCustomers(prev => [newCustomer, ...prev]);
        setShowApproveModal(false);
        setPhoneNumber('');
        setCustomerName('');
      }
    } catch (error: any) {
      console.error('Error approving customer:', error);
      if (error.response?.status === 404) {
        Alert.alert(
          'Customer Not Found', 
          'This phone number is not registered with any customer. Please check the number and try again.'
        );
      } else {
        Alert.alert('Problem!', 'Could not approve customer. Please try again.');
      }
    } finally {
      setApproveLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'khata') {
      await fetchCustomerDues();
    } else {
      await fetchApprovedCustomers();
    }
    setRefreshing(false);
  };

  const navigateToTransactions = (customer: Customer) => {
    navigation.navigate('CustomerTransactions', {
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      currentDue: customer.currentDue,
      transactions: customer.transactions,
    });
  };

  const renderCustomerItem = ({item}: {item: Customer}) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => navigateToTransactions(item)}
    >
      <View style={styles.customerHeader}>
        <Icon name="person" size={24} color="#3498db" />
        <View style={styles.customerDetails}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.customerPhone}>{item.customerPhone}</Text>
        </View>
      </View>
      <View style={styles.rightSection}>
        <View style={styles.dueContainer}>
          <Text style={styles.dueLabel}>Due Amount</Text>
          <Text style={[
            styles.dueAmount,
            item.currentDue > 0 ? styles.positiveAmount : styles.zeroAmount
          ]}>
            ₹{Math.abs(item.currentDue).toFixed(2)}
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color="#bdc3c7" />
      </View>
    </TouchableOpacity>
  );

  const renderApprovedCustomerItem = ({item}: {item: ApprovedCustomer}) => (
    <View style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <Icon name="person" size={24} color="#2ecc71" />
        <View style={styles.customerDetails}>
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.customerPhone}>{item.customerPhone}</Text>
        </View>
      </View>
      <View style={styles.rightSection}>
        <View style={styles.approvedContainer}>
          <Text style={styles.approvedLabel}>Approved</Text>
          <Text style={styles.approvedDate}>
            {new Date(item.approvedAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.actionsContainer}>
          <Icon name="check-circle" size={24} color="#2ecc71" />
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => revokeCustomerEligibility(item)}
            disabled={revokeLoading === item.customerId}
          >
            {revokeLoading === item.customerId ? (
              <Icon name="hourglass-empty" size={20} color="#e74c3c" />
            ) : (
              <Icon name="cancel" size={20} color="#e74c3c" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon 
        name={activeTab === 'khata' ? 'book' : 'people'} 
        size={64} 
        color="#bdc3c7" 
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'khata' ? 'No Customer Dues' : 'No Approved Customers'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'khata' 
          ? 'Customer dues will appear here when available'
          : 'Approved customers will appear here when available'
        }
      </Text>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <SafeAreaView style={styles.container}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <View style={styles.tabButtons}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'khata' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('khata')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'khata' && styles.activeTabButtonText,
                ]}
              >
                Khata
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'approved' && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab('approved')}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === 'approved' && styles.activeTabButtonText,
                ]}
              >
                Approved Customers
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        {activeTab === 'khata' ? (
          <FlatList
            data={customers}
            renderItem={renderCustomerItem}
            keyExtractor={item => item.customerId}
            contentContainerStyle={[styles.listContainer, styles.listWithAd]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={!loading ? renderEmptyState : null}
          />
        ) : (
          <>
            {approvedLoading && approvedCustomers.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading approved customers...</Text>
              </View>
            ) : (
              <FlatList
                data={approvedCustomers}
                renderItem={renderApprovedCustomerItem}
                keyExtractor={item => item.customerId}
                contentContainerStyle={[styles.listContainer, styles.listWithAd]}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={!approvedLoading ? renderEmptyState : null}
              />
            )}
          </>
        )}
        
        {/* Approve Customer Button - Only show in Approved tab */}
        {activeTab === 'approved' && (
          <View style={styles.approveButtonContainer}>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => setShowApproveModal(true)}
            >
              <Icon name="person-add" size={20} color="#fff" />
              <Text style={styles.approveButtonText}>Approve Customer</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
      
      {/* Sticky Banner Ad */}
      <StickyBannerAd />
      
      {/* Approve Customer Modal */}
      <Modal
        visible={showApproveModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowApproveModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Approve Customer</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowApproveModal(false);
                    setPhoneNumber('');
                    setCustomerName('');
                  }}
                >
                  <Icon name="close" size={24} color="#7f8c8d" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Customer Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter customer full name"
                  value={customerName}
                  onChangeText={setCustomerName}
                  autoCapitalize="words"
                  autoFocus={true}
                />
              </View>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Customer Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCodeContainer}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter 10-digit phone number"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  approveLoading && styles.submitButtonDisabled
                ]}
                onPress={approveCustomer}
                disabled={approveLoading}
              >
                {approveLoading ? (
                  <Text style={styles.submitButtonText}>Processing...</Text>
                ) : (
                  <>
                    <Icon name="check" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Submit</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listWithAd: {
    paddingBottom: 80, // Add space for sticky banner ad
  },
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  tabButtons: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8e8e93',
  },
  activeTabButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  listContainer: {
    padding: 20,
    flexGrow: 1,
  },
  customerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  dueLabel: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 2,
  },
  dueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  positiveAmount: {
    color: '#e74c3c',
  },
  zeroAmount: {
    color: '#2ecc71',
  },
  approvedContainer: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  approvedLabel: {
    fontSize: 12,
    color: '#2ecc71',
    marginBottom: 2,
    fontWeight: '600',
  },
  approvedDate: {
    fontSize: 12,
    color: '#95a5a6',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  revokeButton: {
    padding: 4,
    borderRadius: 4,
  },
  approveButtonContainer: {
    padding: 20,
    paddingBottom: 100, // Add space for sticky banner ad
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  approveButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  approveButtonText: {
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
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 10,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  countryCodeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
    backgroundColor: '#f1f3f4',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2c3e50',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});

export default KhataScreen;
