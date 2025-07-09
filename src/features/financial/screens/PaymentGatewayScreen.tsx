import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../../../store/ordersStore';
import { storage } from '../../../utils/storage';
import { config } from '../../../config';

interface PaymentGatewayScreenProps {
  route: {
    params: {
      paymentAmount: number;
    };
  };
}

const PaymentGatewayScreen = ({ route }: PaymentGatewayScreenProps) => {
  const { paymentAmount } = route.params;
  
  // Get branchId directly from storage instead of route params
  const branchId = storage.getString('userId');
  const navigation = useNavigation();
  const { setWalletBalance } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<WebView>(null);
  
  // Get the server base URL from config (strip the /api path and use /public for HTML files)
  const serverBaseUrl = config.BASE_URL.replace('/api', '');
  
  // Get access token from storage
  const token = storage.getString('accessToken') || '';

  // Validate branchId before constructing the payment URL
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Construct the payment URL with parameters according to required format
  const paymentUrl = branchId 
    ? `${serverBaseUrl}/public/payment.html?branchId=${branchId}&token=${token}&balance=${paymentAmount}`
    : '';

  // Validate required parameters on component mount
  useEffect(() => {
    if (!branchId) {
      setValidationError('Branch ID is required for payment processing');
      setError('Branch ID is required for payment processing');
    }
  }, [branchId]);

  useEffect(() => {
    // Handle back button press to show confirmation alert
    const backAction = () => {
      Alert.alert(
        'Cancel Payment?',
        'Are you sure you want to cancel this payment?',
        [
          { text: 'No', style: 'cancel', onPress: () => {} },
          { text: 'Yes', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'PAYMENT_SUCCESS') {
        // Update wallet balance in app state
        const newBalance = data.data.newBalance;
        setWalletBalance(newBalance);
        storage.set('walletBalance', newBalance);
        
        // Add payment to history (this would typically be done by refetching data)
        
        // Show success message and navigate back
        Alert.alert('Success', 'Payment processed successfully', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else if (data.type === 'CLOSE_WEBVIEW') {
        // Close WebView when requested by payment page
        navigation.goBack();
      } else if (data.type === 'PAYMENT_ERROR') {
        // Handle payment error
        setError(data.message || 'Payment processing failed');
        Alert.alert('Payment Failed', data.message || 'Payment processing failed', [
          { text: 'Try Again', onPress: () => webViewRef.current?.reload() },
          { text: 'Cancel', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (err) {
      console.error('Error processing WebView message:', err);
      setError('Failed to process payment response');
    }
  };

  // JavaScript to inject into WebView to listen for navigation events and post messages
  const injectedJavaScript = `
    // Listen for payment success events
    window.addEventListener('message', function(event) {
      window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
    });

    // Inject communication channel
    true;
  `;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Alert.alert(
              'Cancel Payment?',
              'Are you sure you want to cancel this payment?',
              [
                { text: 'No', style: 'cancel', onPress: () => {} },
                { text: 'Yes', style: 'destructive', onPress: () => navigation.goBack() },
              ]
            );
          }}>
          <Icon name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* WebView */}
      {error || validationError ? (
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error || validationError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              webViewRef.current?.reload();
            }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={{ uri: paymentUrl }}
          style={styles.webView}
          onMessage={handleMessage}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            setError(`Failed to load payment page: ${nativeEvent.description}`);
            setLoading(false);
          }}
          injectedJavaScript={injectedJavaScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      )}

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Payment Gateway...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  backButton: {
    padding: 4,
  },
  webView: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
 
export default PaymentGatewayScreen;
