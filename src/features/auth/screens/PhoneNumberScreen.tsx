import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../../../navigation/types';
import {useStore} from '../../../store/ordersStore';
import {storage} from '../../../utils/storage';

type PhoneNumberScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PhoneNumberScreen'
>;

type PhoneNumberScreenRouteProp = RouteProp<
  RootStackParamList,
  'PhoneNumberScreen'
>;

interface PhoneNumberScreenProps {
  navigation: PhoneNumberScreenNavigationProp;
  route: PhoneNumberScreenRouteProp;
}

// Country code data
interface CountryCode {
  name: string;
  code: string;
  dial_code: string;
  flag: string;
}

// List of common country codes
const countryCodes: CountryCode[] = [
  {
    name: 'India',
    code: 'IN',
    dial_code: '+91',
    flag: '🇮🇳',
  },
  {
    name: 'United States',
    code: 'US',
    dial_code: '+1',
    flag: '🇺🇸',
  },
  {
    name: 'United Kingdom',
    code: 'GB',
    dial_code: '+44',
    flag: '🇬🇧',
  },
  {
    name: 'Canada',
    code: 'CA',
    dial_code: '+1',
    flag: '🇨🇦',
  },
  {
    name: 'Australia',
    code: 'AU',
    dial_code: '+61',
    flag: '🇦🇺',
  },
  {
    name: 'Singapore',
    code: 'SG',
    dial_code: '+65',
    flag: '🇸🇬',
  },
  {
    name: 'United Arab Emirates',
    code: 'AE',
    dial_code: '+971',
    flag: '🇦🇪',
  },
  {
    name: 'Malaysia',
    code: 'MY',
    dial_code: '+60',
    flag: '🇲🇾',
  },
];

const PhoneNumberScreen: React.FC<PhoneNumberScreenProps> = ({
  route,
  navigation,
}) => {
  const {formData, branchId, isResubmit} = route.params || {};
  const {branches} = useStore();
  const branch = isResubmit ? branches.find(b => b.id === branchId) : null;

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(
    countryCodes[0],
  ); // Default to India (+91)
  const [modalVisible, setModalVisible] = useState(false);

  // Get the full international phone number
  const getFullPhoneNumber = () => {
    return `${selectedCountry.dial_code}${phoneNumber}`;
  };

  useEffect(() => {
    if (isResubmit && branch) {
      // Extract phone number from stored value if it has country code
      const storedPhone = branch.phone;
      if (storedPhone && storedPhone.startsWith('+')) {
        // Find the country code and set it
        const country = countryCodes.find(c =>
          storedPhone.startsWith(c.dial_code),
        );
        if (country) {
          setSelectedCountry(country);
          setPhoneNumber(storedPhone.substring(country.dial_code.length));
        } else {
          setPhoneNumber(storedPhone);
        }
      } else {
        setPhoneNumber(storedPhone);
      }
    } else if (formData?.phone) {
      // Handle formData phone similarly
      const storedPhone = formData.phone;
      if (storedPhone && storedPhone.startsWith('+')) {
        const country = countryCodes.find(c =>
          storedPhone.startsWith(c.dial_code),
        );
        if (country) {
          setSelectedCountry(country);
          setPhoneNumber(storedPhone.substring(country.dial_code.length));
        } else {
          setPhoneNumber(storedPhone);
        }
      } else {
        setPhoneNumber(storedPhone);
      }
    }
  }, [isResubmit, branch, formData]);

  const handleNext = useCallback(() => {
    // Validate phone number format based on country
    const fullPhoneNumber = getFullPhoneNumber();

    if (!phoneNumber || phoneNumber.length < 8 || !/^\d+$/.test(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setIsLoading(true);

    const updatedFormData = {
      ...formData,
      phone: fullPhoneNumber, // Store the full international format
    };

    // Store the phone number with country code in MMKV for future reference
    storage.set('branchPhone', fullPhoneNumber);

    navigation.navigate('UploadBranchDocs', {
      formData: updatedFormData,
      branchId: isResubmit ? branchId : undefined,
      isResubmit: !!isResubmit,
    });

    setIsLoading(false);
  }, [
    phoneNumber,
    selectedCountry,
    formData,
    branchId,
    isResubmit,
    navigation,
  ]);

  const renderCountryItem = ({item}: {item: CountryCode}) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item);
        setModalVisible(false);
      }}>
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.name}</Text>
      <Text style={styles.countryDialCode}>{item.dial_code}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>
        {isResubmit ? 'Resubmit Branch Application' : 'Enter Phone Number'}
      </Text>
      <Text style={styles.subheader}>
        {isResubmit
          ? 'Update your branch details to resubmit your application'
          : 'Please provide a contact number for the branch'}
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Branch Phone Number *</Text>
        <View style={styles.phoneInputContainer}>
          {/* Country code selector */}
          <TouchableOpacity
            style={[
              styles.countryCodeSelector,
              isResubmit && styles.disabledInput,
            ]}
            onPress={() => !isResubmit && setModalVisible(true)}
            disabled={isResubmit}>
            <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
            <Text style={styles.countryCode}>{selectedCountry.dial_code}</Text>
            {!isResubmit && (
              <Icon name="arrow-drop-down" size={20} color="#7f8c8d" />
            )}
          </TouchableOpacity>

          {/* Phone number input */}
          <View
            style={[styles.inputContainer, isResubmit && styles.disabledInput]}>
            <Icon name="phone" size={20} color="#7f8c8d" style={styles.icon} />
            <TextInput
              placeholder="Enter phone number"
              placeholderTextColor="#95a5a6"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="numeric"
              style={styles.input}
              editable={!isResubmit}
            />
          </View>
        </View>
        {isResubmit && (
          <Text style={styles.warningText}>
            Phone number cannot be changed during resubmission as it's used to
            identify your branch.
          </Text>
        )}
        <Text style={styles.hint}>
          Enter your phone number with country code (e.g.,{' '}
          {selectedCountry.dial_code} XXXXXXXXXX)
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          (isLoading || !phoneNumber) && styles.buttonDisabled,
        ]}
        onPress={handleNext}
        disabled={isLoading || !phoneNumber}>
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Text style={styles.buttonText}>
              {isResubmit ? 'Next (Resubmit)' : 'Next'}
            </Text>
            <Icon name="arrow-forward" size={20} color="white" />
          </>
        )}
      </TouchableOpacity>

      {/* Country code modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={countryCodes}
              renderItem={renderCountryItem}
              keyExtractor={item => item.code}
              style={styles.countryList}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subheader: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    fontWeight: '500',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCodeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: '#ecf0f1',
    marginRight: 8,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 4,
  },
  countryCode: {
    fontSize: 16,
    color: '#2c3e50',
    marginRight: 4,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#2c3e50',
    fontSize: 16,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#2ecc71',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  buttonDisabled: {
    backgroundColor: '#95a5a6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 8,
    marginLeft: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  countryList: {
    paddingHorizontal: 16,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 12,
  },
  countryDialCode: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  warningText: {
    fontSize: 12,
    color: '#e74c3c',
    marginTop: 8,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  disabledInput: {
    backgroundColor: '#f1f2f6',
    borderColor: '#dfe4ea',
    opacity: 0.8,
  },
});

export default PhoneNumberScreen;
