import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {StackScreenProps} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/types';
import Icon from 'react-native-vector-icons/MaterialIcons';
// No need for completeBranchRegistration since verification is already done
import {storage} from '../../../utils/storage';
import {useStore} from '../../../store/ordersStore';

type RegisteredBranchDetailsProps = StackScreenProps<
  RootStackParamList,
  'RegisteredBranchDetails'
>;

const RegisteredBranchDetails: React.FC<RegisteredBranchDetailsProps> = ({
  route,
  navigation,
}) => {
  const {phone, formData, branchId, isResubmit} = route.params || {};
  const [isLoading, setIsLoading] = useState(false);
  const {addBranch, setUserId} = useStore();

  const handleCompleteRegistration = () => {
    // Get the branch ID from the response data stored in MMKV
    const storedBranchId = storage.getString('userId');
    if (!storedBranchId) {
      Alert.alert('Error', 'Branch ID not found. Please try registering again.');
      return;
    }

    // Navigate to status screen with the stored branch ID
    navigation.navigate('StatusScreen', {branchId: storedBranchId});
  };

  // Format address for display
  const formatAddress = (address: any) => {
    if (!address) return 'No address provided';

    const addressObj =
      typeof address === 'string' ? JSON.parse(address) : address;
    return `${addressObj.street}, ${addressObj.area}, ${addressObj.city} - ${addressObj.pincode}`;
  };

  // Format location for display
  const formatLocation = (location: any) => {
    if (!location) return 'No location provided';

    const locationObj =
      typeof location === 'string' ? JSON.parse(location) : location;
    if (locationObj.type === 'Point') {
      return `Latitude: ${locationObj.coordinates[1]}, Longitude: ${locationObj.coordinates[0]}`;
    } else if (locationObj.latitude && locationObj.longitude) {
      return `Latitude: ${locationObj.latitude}, Longitude: ${locationObj.longitude}`;
    }
    return 'Invalid location format';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Registration Details</Text>
        <Text style={styles.subheader}>
          Review your branch information before final submission
        </Text>

        <View style={styles.detailsContainer}>
          <DetailItem label="Branch Name" value={formData.name} icon="store" />

          <DetailItem label="Phone Number" value={phone} icon="phone" />

          <DetailItem
            label="Email"
            value={formData.branchEmail || 'Not provided'}
            icon="email"
          />

          <DetailItem
            label="Address"
            value={formatAddress(formData.branchAddress || formData.address)}
            icon="location-on"
          />

          <DetailItem
            label="Location"
            value={formatLocation(formData.branchLocation || formData.location)}
            icon="place"
          />

          <DetailItem
            label="Opening Time"
            value={formData.openingTime}
            icon="access-time"
          />

          <DetailItem
            label="Closing Time"
            value={formData.closingTime}
            icon="access-time"
          />

          <DetailItem
            label="Owner Name"
            value={formData.ownerName}
            icon="person"
          />

          <DetailItem
            label="Government ID"
            value={formData.govId}
            icon="badge"
          />

          <DetailItem
            label="Delivery Service"
            value={
              formData.deliveryServiceAvailable === true ||
              formData.deliveryServiceAvailable === 'yes'
                ? 'Available'
                : 'Not Available'
            }
            icon="delivery-dining"
          />

          <DetailItem
            label="Self Pickup"
            value={
              formData.selfPickup === true || formData.selfPickup === 'yes'
                ? 'Available'
                : 'Not Available'
            }
            icon="store-mall-directory"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleCompleteRegistration}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>Complete Registration</Text>
              <Icon name="check-circle" size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper component for rendering individual detail items
const DetailItem = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) => (
  <View style={styles.detailItem}>
    <View style={styles.detailIconContainer}>
      <Icon name={icon} size={24} color="#007AFF" />
    </View>
    <View style={styles.detailContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  detailsContainer: {
    marginBottom: 24,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
  },
  detailItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  detailIconContainer: {
    width: 40,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    width: '100%',
    gap: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RegisteredBranchDetails;
