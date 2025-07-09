import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import DeliveryServiceToggle from '../../../components/delivery/DeliveryServiceToggle';
import {useStore} from '../../../store/ordersStore';
import io from 'socket.io-client';
import {fetchDeliveryPartners} from '../../../services/api';
import api from '../../../services/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/AppNavigator';

const socket = io('https://dokirana-85740.el.r.appspot.com/',  {
  transports: ['websocket'],
  reconnection: true,
});

const MAX_DELIVERY_PARTNERS = 5;

type DeliveryServiceNavigationProp = StackNavigationProp<
  RootStackParamList,
  'DeliveryService'
>;

interface DeliveryServiceProps {
  navigation: DeliveryServiceNavigationProp;
}

interface DeliveryPartner {
  id: string;
  name: string;
  age: number;
  status: string;
  photo: string;
}

const DeliveryService: React.FC<DeliveryServiceProps> = ({navigation}) => {
  const {
    userId,
    setDeliveryServiceAvailable,
    deliveryPartners,
    setDeliveryPartners,
  } = useStore();

  useEffect(() => {
    if (!userId) {
      console.error(
        'No userId available - cannot connect to socket or fetch data',
      );
      return;
    }

    const syncDeliveryPartners = async () => {
      try {
        const partners = await fetchDeliveryPartners(userId);
        console.log('Fetched partners:', partners);
        setDeliveryPartners(
          partners.map(p => ({
            id: p._id,
            status: p.status,
            name: p.name || 'Unnamed Partner',
            age: p.age,
            photo:
              p.documents && Array.isArray(p.documents)
                ? p.documents.find(doc => doc.type === 'photo')?.url || ''
                : '',
          })),
        );
      } catch (error) {
        console.error('Failed to fetch delivery partners:', error);
      }
    };

    const fetchDeliveryServiceStatus = async () => {
      try {
        const response = await api.get('/syncmarts/delivery'); // Adjust endpoint if needed
        const {deliveryServiceAvailable} = response.data;
        if (typeof deliveryServiceAvailable === 'boolean') {
          setDeliveryServiceAvailable(deliveryServiceAvailable);
        } else {
          console.warn('Invalid deliveryServiceAvailable format from API');
        }
      } catch (error) {
        console.error('Failed to fetch delivery service status:', error);
      }
    };

    syncDeliveryPartners();
    fetchDeliveryServiceStatus(); // Fetch initial status

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      socket.emit('joinBranch', userId);
    });

    socket.on('connect_error', err =>
      console.error('Socket connection error:', err.message),
    );

    socket.on('syncmart:delivery-service-available', data => {
      console.log('Socket syncmart:delivery-service-available received:', data);
      setDeliveryServiceAvailable(data.deliveryServiceAvailable);
    });

    return () => {
      socket.off('syncmart:delivery-service-available');
      socket.off('connect_error');
      socket.off('connect');
    };
  }, [userId, setDeliveryServiceAvailable, setDeliveryPartners]);

  const handleRegisterPress = () => {
    if (deliveryPartners.length >= MAX_DELIVERY_PARTNERS) {
      Alert.alert(
        'Registration Limit Reached',
        `Maximum of ${MAX_DELIVERY_PARTNERS} delivery partners already registered.`,
        [{text: 'OK'}],
      );
      return;
    }
    navigation.navigate('DeliveryPartnerAuth');
  };

  const handlePartnerPress = (partner: DeliveryPartner) => {
    navigation.navigate('DeliveryStatus', {
      partner: {
        id: partner.id,
        name: partner.name,
        age: partner.age,
        status: partner.status,
        photoUrl: partner.photo,
      },
    });
  };

  if (!userId) {
    return <Text>Please log in to continue.</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Service Management</Text>
        <Text style={styles.subtitle}>Manage your delivery operations</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Availability</Text>
        <View style={styles.toggleContainer}>
          <DeliveryServiceToggle socket={socket} />
        </View>
      </View>

      <TouchableOpacity
        style={[
          styles.registerButton,
          deliveryPartners.length >= MAX_DELIVERY_PARTNERS &&
            styles.disabledButton,
        ]}
        onPress={handleRegisterPress}
        disabled={deliveryPartners.length >= MAX_DELIVERY_PARTNERS}>
        <Icon name="person-add" size={20} color="#fff" />
        <Text style={styles.registerButtonText}>
          Register New Delivery Partner
        </Text>
      </TouchableOpacity>

      {deliveryPartners.length > 0 ? (
        <View style={styles.partnersSection}>
          <Text style={styles.sectionTitle}>
            Registered Partners ({deliveryPartners.length}/
            {MAX_DELIVERY_PARTNERS})
          </Text>
          {deliveryPartners.map(partner => (
            <TouchableOpacity
              key={partner.id}
              style={styles.partnerCard}
              onPress={() => handlePartnerPress(partner)}>
              <Text style={styles.partnerId}>ID: {partner.id}</Text>
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusIndicator,
                    partner.status === 'approved' && styles.activeIndicator,
                    partner.status === 'pending' && styles.pendingIndicator,
                    partner.status === 'rejected' && styles.inactiveIndicator,
                  ]}
                />
                <Text style={styles.partnerStatus}>{partner.status}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Icon name="local-shipping" size={40} color="#bdc3c7" />
          <Text style={styles.emptyText}>No registered delivery partners</Text>
        </View>
      )}

      <Text style={styles.disclaimer}>
        You can only add 5 Delivery Partners with your store. If you need to add
        more delivery partners, please contact customer care.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f6fa',
  },
  header: {
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  section: {
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
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  registerButton: {
    flexDirection: 'row',
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    gap: 10,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    opacity: 0.7,
  },
  disclaimer: {
    color: '#ff0000',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  partnersSection: {
    marginTop: 10,
  },
  partnerCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  partnerId: {
    color: '#2c3e50',
    fontSize: 14,
    flexShrink: 1,
    marginRight: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeIndicator: {
    backgroundColor: '#2ecc71',
  },
  pendingIndicator: {
    backgroundColor: '#f1c40f',
  },
  inactiveIndicator: {
    backgroundColor: '#e74c3c',
  },
  partnerStatus: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fdfdfd',
    borderRadius: 12,
    marginTop: 20,
  },
  emptyText: {
    color: '#95a5a6',
    marginTop: 10,
    fontSize: 14,
  },
});

export default DeliveryService;
