import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../../navigation/types';
import {storage} from '../../../utils/storage';
import {initiateLogin, demoBranchLogin} from '../../../services/api';
import {useStore} from '../../../store/ordersStore';
import {jwtDecode} from 'jwt-decode';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Common country codes
const countryCodes = [
  {code: '+91', country: 'India'},
  {code: '+1', country: 'USA/Canada'},
  {code: '+44', country: 'UK'},
  {code: '+971', country: 'UAE'},
  {code: '+966', country: 'Saudi Arabia'},
  {code: '+65', country: 'Singapore'},
  {code: '+61', country: 'Australia'},
  {code: '+49', country: 'Germany'},
  {code: '+33', country: 'France'},
  {code: '+86', country: 'China'},
];

type AuthNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Authentication'
>;

type JwtPayload = {
  userId: string;
  branchId: string;
  role: string;
  exp: number;
  iat: number;
};

const AuthenticationScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const {setUserId} = useStore();
  const [countryCode, setCountryCode] = useState('+91');
  const [showCountryCodeModal, setShowCountryCodeModal] = useState(false);

  // Check if the phone number is already stored
  useEffect(() => {
    const checkStoredPhone = async () => {
      const storedPhone = storage.getString('branchPhone');
      if (storedPhone) {
        // If stored phone has country code, extract it
        if (storedPhone.startsWith('+')) {
          const code =
            countryCodes.find(c => storedPhone.startsWith(c.code))?.code ||
            '+91';

          setCountryCode(code);
          setPhone(storedPhone.substring(code.length));
        } else {
          setPhone(storedPhone);
        }
      }
    };
    checkStoredPhone();
  }, []);

  // Validate the phone number
  const isValidPhone = (phoneNumber: string): boolean => {
    // Basic validation - phone number without country code should be 10 digits
    return /^\d{10}$/.test(phoneNumber);
  };

  // Handle the login process
  const handleLogin = async () => {
    // Validate phone number
    if (!isValidPhone(phone)) {
      Alert.alert(
        'Invalid Input',
        'Please enter a valid 10-digit phone number',
      );
      return;
    }

    setIsLoading(true);

    // Combine country code and phone
    const fullPhoneNumber = `${countryCode}${phone}`;

    try {
      // If tester phone, bypass OTP entirely
      if (phone === '9922992211') {
        console.log('Tester phone detected, using demoBranchLogin');
        const demoResponse = await demoBranchLogin(phone);
        if (demoResponse && demoResponse.data && demoResponse.data.accessToken) {
          // Persist tokens
          const {accessToken, refreshToken, branch} = demoResponse.data;
          if (accessToken) storage.set('accessToken', accessToken);
          if (refreshToken) storage.set('refreshToken', refreshToken);

          // Persist branch specifics
          if (branch) {
            if (branch._id) {
              storage.set('branchId', branch._id);
            }
            storage.set('branchPhone', branch.phone || '+91' + phone);
            storage.set('isRegistered', true);
            storage.set('isApproved', branch.status === 'approved');
            if (branch.name) storage.set('branchName', branch.name);
            if (branch.ownerName) storage.set('ownerName', branch.ownerName);
          }

          // Store branchId as userId for API compatibility
          if (branch && branch._id) {
            setUserId(branch._id);
            storage.set('userId', branch._id);
          }

          // Navigate directly to Home (will redirect to Status if not approved)
          navigation.reset({index:0,routes:[{name:'HomeScreen'}]});
          return;
        }
      }
      console.log('Initiating login with phone:', fullPhoneNumber);
      const response = await initiateLogin(fullPhoneNumber);

      // Extract session and timer details from server response (supports nested structures)
      let sessionId: string | undefined;
      let validityPeriod: number | undefined;
      let retryAfter: number | undefined;

      if ((response as any)?.data?.data) {
        sessionId = (response as any).data.data.sessionId;
        validityPeriod = parseInt(String((response as any).data.data.validityPeriod));
        retryAfter = parseInt(String((response as any).data.data.retryAfter));
      } else if ((response as any)?.data) {
        sessionId = (response as any).data.sessionId;
        validityPeriod = parseInt(String((response as any).data.validityPeriod));
        retryAfter = parseInt(String((response as any).data.retryAfter));
      } else {
        sessionId = (response as any).sessionId;
        validityPeriod = parseInt(String((response as any).validityPeriod));
        retryAfter = parseInt(String((response as any).retryAfter));
      }

      if (sessionId) {
        storage.set('sessionId', sessionId);
      }

      if (response && response.status === 'success') {
        // Store the complete phone number for future use
        storage.set('branchPhone', fullPhoneNumber);

        // Navigate to OTP verification screen
        console.log(
          'Login initiation successful, navigating to OTP verification',
        );
        navigation.navigate('OTPVerification', {
          phone: fullPhoneNumber,
          sessionId: sessionId,
          validityPeriod: validityPeriod,
          retryAfter: retryAfter,
          isLogin: true,
          formData: null,
          branchId: undefined,
          isResubmit: false,
        });
      } else {
        throw new Error('Login initiation failed');
      }
    } catch (err) {
      console.error('Login Error:', err);
      const errorMessage =
        (err as any).response?.data?.message ||
        (err as Error).message ||
        'Invalid phone number';
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const selectCountryCode = (code: string) => {
    setCountryCode(code);
    setShowCountryCodeModal(false);
  };

  const renderCountryCodeItem = ({
    item,
  }: {
    item: {code: string; country: string};
  }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => selectCountryCode(item.code)}>
      <Text style={styles.countryCode}>{item.code}</Text>
      <Text style={styles.countryName}>{item.country}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Branch Login</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneInputContainer}>
              <TouchableOpacity
                style={styles.countryCodeSelector}
                onPress={() => setShowCountryCodeModal(true)}
                disabled={isLoading}>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
                <Icon name="arrow-drop-down" size={24} color="#333" />
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter 10-digit phone number"
                keyboardType="phone-pad"
                maxLength={10}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (!isValidPhone(phone) || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!isValidPhone(phone) || isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Country Code Modal */}
      <Modal
        visible={showCountryCodeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCountryCodeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country Code</Text>
              <TouchableOpacity
                onPress={() => setShowCountryCodeModal(false)}
                style={styles.closeButton}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={countryCodes}
              renderItem={renderCountryCodeItem}
              keyExtractor={item => item.code}
              style={styles.countryList}
            />
          </View>
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
  keyboardAvoidingView: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#340e5c',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 24,
  },
  countryCodeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 56,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    marginRight: 4,
  },
  phoneInput: {
    flex: 1,
    height: 56,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 16,
    backgroundColor: 'white',
    fontSize: 16,
    color: '#333',
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#340e5c',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#a68cb9',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  countryList: {
    paddingHorizontal: 20,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    width: 60,
  },
  countryName: {
    fontSize: 16,
    color: '#666',
  },
});

export default AuthenticationScreen;
